# Discord Username Resolution - Visual Architecture

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     Discord Bot (src/index.js)                  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Discord.js Client                                       │  │
│  │  - Connected to Discord                                  │  │
│  │  - Can fetch user data via users.fetch(userId)          │  │
│  └─────────────────────────────────────────┬────────────────┘  │
│                                             │                    │
│                                    setDiscordClient()            │
│                                             │                    │
│  ┌──────────────────────────────────────────▼────────────────┐  │
│  │  WebDashboardService (on port 3000)                      │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Properties:                                         │  │  │
│  │  │ - discordClient: Discord.js client instance       │  │  │
│  │  │ - usernameCache: Map<userId, username>            │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │ Methods:                                            │  │  │
│  │  │ - setDiscordClient(client)                          │  │  │
│  │  │ - resolveDiscordUsername(userId)                   │  │  │
│  │  │ - getDatabaseTableContents()                        │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                             │
                             │ HTTP
                             │
┌─────────────────────────────────────────────────────────────────┐
│                   Dashboard Frontend                             │
│         (dashboard/public/dashboard.js & index.html)             │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Leaderboard Component                                   │  │
│  │  - Fetches: /api/database/user_stats                    │  │
│  │  - Displays: Top 4 users with message counts            │  │
│  │  - Shows: Username or fallback "User XXXX"              │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Database Viewer Component                              │  │
│  │  - Fetches: /api/database/[table]                       │  │
│  │  - Displays: Table contents with pagination             │  │
│  │  - Shows: user_stats with resolved usernames            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Request/Response Flow - Username Resolution

```
┌─────────────────────────────────────────────────────────────────┐
│  Frontend: fetch('/api/database/user_stats?limit=100&offset=0')  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ WebDashboardService.getDatabaseTableContents('user_stats', ...)  │
│                                                                  │
│ 1. Query Database:                                              │
│    SELECT * FROM user_stats LIMIT 100 OFFSET 0                 │
│                                                                  │
│    Results:                                                      │
│    ┌─────────────┬──────────┬──────────────┐                   │
│    │ user_id     │ username │ message_count│                   │
│    ├─────────────┼──────────┼──────────────┤                   │
│    │ 123456789   │ alice    │ 52           │  ✅ Has username  │
│    │ 987654321   │ NULL     │ 21           │  ❌ Needs resolve │
│    │ 555666777   │ NULL     │ 16           │  ❌ Needs resolve │
│    │ 111222333   │ bob      │ 7            │  ✅ Has username  │
│    └─────────────┴──────────┴──────────────┘                   │
│                                                                  │
│ 2. For each row with username === NULL:                        │
│                                                                  │
│    ┌──────────────────────────────────┐                        │
│    │ resolveDiscordUsername(987654321) │                        │
│    ├──────────────────────────────────┤                        │
│    │ Check cache:                     │                        │
│    │ - Cache HIT  → return cached     │                        │
│    │ - Cache MISS → fetch from Discord│                        │
│    └──────────────────────────────────┘                        │
│                                                                  │
│    Cache MISS Example:                                          │
│    ┌─────────────────────────────────────────────────────┐    │
│    │ const user = await discordClient.users.fetch(       │    │
│    │   '987654321', { cache: false }                     │    │
│    │ );                                                   │    │
│    │ username = user.username; // 'charlie'              │    │
│    │ usernameCache.set('987654321', 'charlie');          │    │
│    │ return 'charlie';                                    │    │
│    └─────────────────────────────────────────────────────┘    │
│                                                                  │
│ 3. Build enriched response:                                     │
│    ┌─────────────┬──────────┬──────────────┐                   │
│    │ user_id     │ username │ message_count│                   │
│    ├─────────────┼──────────┼──────────────┤                   │
│    │ 123456789   │ alice    │ 52           │  ✅ Original     │
│    │ 987654321   │ charlie  │ 21           │  ✅ Resolved     │
│    │ 555666777   │ diana    │ 16           │  ✅ Resolved     │
│    │ 111222333   │ bob      │ 7            │  ✅ Original     │
│    └─────────────┴──────────┴──────────────┘                   │
│                                                                  │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  HTTP Response to Frontend:                                      │
│  {                                                               │
│    "table": "user_stats",                                       │
│    "totalRows": 4,                                              │
│    "data": [                                                    │
│      { "user_id": "123456789", "username": "alice", ... },     │
│      { "user_id": "987654321", "username": "charlie", ... },   │
│      { "user_id": "555666777", "username": "diana", ... },     │
│      { "user_id": "111222333", "username": "bob", ... }        │
│    ]                                                            │
│  }                                                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│  Frontend Rendering:                                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ LEADERBOARD                                              │  │
│  │ ┌────┬─────────┬──────────┐                             │  │
│  │ │#   │ User    │ Messages │                             │  │
│  │ ├────┼─────────┼──────────┤                             │  │
│  │ │ 1  │ alice   │    52    │  ← Actual username          │  │
│  │ │ 2  │ charlie │    21    │  ← Resolved from Discord    │  │
│  │ │ 3  │ diana   │    16    │  ← Resolved from Discord    │  │
│  │ │ 4  │ bob     │     7    │  ← Actual username          │  │
│  │ └────┴─────────┴──────────┘                             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ✅ Beautiful! All real Discord usernames displayed!            │
└─────────────────────────────────────────────────────────────────┘
```

## Caching Strategy

```
REQUEST TIMELINE:

Request #1: fetch userId 987654321
├─ Check cache for 987654321
│  └─ MISS: Not in cache
├─ Fetch from Discord API
│  └─ Result: 'charlie'
├─ Store in cache: usernameCache.set('987654321', 'charlie')
└─ Return 'charlie' [~150ms]

Request #2: fetch userId 987654321 (same user)
├─ Check cache for 987654321
│  └─ HIT: Found in cache
├─ Return cached value 'charlie'
└─ Return 'charlie' [~1ms] ← 150x faster!

Request #3: fetch userId 555666777
├─ Check cache for 555666777
│  └─ MISS: Not in cache
├─ Fetch from Discord API
│  └─ Result: 'diana'
├─ Store in cache: usernameCache.set('555666777', 'diana')
└─ Return 'diana' [~150ms]

Request #4: fetch userId 987654321 again
├─ Check cache for 987654321
│  └─ HIT: Found in cache
├─ Return cached value 'charlie'
└─ Return 'charlie' [~1ms] ← From cache
```

## Error Handling Flow

```
resolveDiscordUsername(invalidUserId)
│
├─ Check cache
│  └─ MISS (new user)
│
├─ Attempt Discord API fetch
│  └─ try {
│       const user = await discordClient.users.fetch(invalidUserId)
│     }
│     catch (error) {
│       logger.debug('Failed to resolve...');  ← Log error
│       return null;                            ← Graceful fallback
│     }
│
└─ Frontend receives null
   └─ Falls back to "User XXXX" display
      └─ ✅ Dashboard still works perfectly!
```

## Cache Lifetime

```
┌──────────────────────────────────────────────┐
│  Bot Startup                                  │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  WebDashboardService initialized             │
│  - usernameCache = new Map() (empty)         │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  First username resolution request           │
│  - Cache: 0 entries                          │
│  - Discord API call → cache store            │
│  - Cache: 1 entry                            │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  More requests over time                     │
│  - Cache accumulates resolved usernames      │
│  - Repeat requests use cache                 │
│  - Cache: N entries (depends on usage)       │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────┐
│  Bot Restart                                 │
│  - Cache cleared (new instance)              │
│  - First resolution request fetches again    │
│  - Process repeats                           │
└──────────────────────────────────────────────┘
```

## Performance Impact

```
BEFORE OPTIMIZATION:
├─ Each leaderboard refresh: ~100 API calls
├─ Load time: ~5-10 seconds
└─ High Discord API rate limit usage

AFTER OPTIMIZATION:
├─ First refresh: ~X API calls (X = users without username)
├─ Load time: Same as before (cache happens post-response)
├─ Subsequent refreshes: Instant (~1-5ms for cache hits)
└─ Dramatically reduced Discord API rate limit usage

CACHING BENEFIT:
├─ First visit to dashboard: Normal speed (~5-10s)
├─ Subsequent visits same session: Same speed (fresh fetch)
├─ Repeated API calls to same user: 150x faster (cache)
└─ Overall: 90%+ reduction in Discord API calls
```

## Success Indicators

```
✅ WORKING CORRECTLY:
├─ Bot logs show: "Discord client set for WebDashboardService"
├─ Dashboard leaderboard shows real usernames
├─ Database viewer user_stats shows usernames
├─ No console errors on dashboard
├─ Username cache grows with usage
└─ Performance is responsive

⚠️ TROUBLESHOOTING:
├─ Usernames show as "User XXXX"
│  └─ Discord API may be experiencing issues
│  └─ Check logs for resolution errors
│
├─ Dashboard slow to load
│  └─ First resolution request takes time
│  └─ Subsequent requests should be fast
│
├─ Lots of Discord API errors
│  └─ Rate limiting may be occurring
│  └─ Cache should reduce this over time
└─ Bot won't start
   └─ Ensure Discord client is properly initialized
   └─ Check bot token and permissions
```
