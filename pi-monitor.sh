#!/bin/bash

# Aszune AI Bot - Performance Monitor Script for Raspberry Pi
# This script helps monitor system resources while the bot is running

# Colors for better readability
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
RESET='\033[0m'

# Function to display usage
display_usage() {
  echo "Usage: $0 [OPTIONS]"
  echo
  echo "Options:"
  echo "  -h, --help      Show this help message"
  echo "  -i, --interval  Set monitoring interval in seconds (default: 5)"
  echo "  -c, --count     Number of times to collect data (default: infinite)"
  echo "  -l, --log       Save output to log file"
  echo
  echo "Example: $0 -i 10 -c 6 -l"
  echo "This will monitor every 10 seconds, 6 times, and save to log"
  exit 0
}

# Parse command line options
INTERVAL=5
COUNT=-1  # Default: run forever
LOG=false
LOG_FILE="pi-performance-$(date +%Y%m%d-%H%M%S).log"

while [ "$1" != "" ]; do
  case $1 in
    -h | --help )        display_usage ;;
    -i | --interval )    shift
                         INTERVAL=$1 ;;
    -c | --count )       shift
                         COUNT=$1 ;;
    -l | --log )         LOG=true ;;
    * )                  display_usage ;;
  esac
  shift
done

# Function to get process details
get_process_details() {
  NODE_PID=$(pgrep -f "node src/index.js" | head -n1)
  
  if [ -z "$NODE_PID" ]; then
    echo -e "${RED}Bot process not found!${RESET}"
    return 1
  fi
  
  # Get CPU usage for the specific process
  CPU_USAGE=$(ps -p $NODE_PID -o %cpu | tail -n1 | tr -d ' ')
  
  # Get memory usage in KB and convert to MB
  MEM_KB=$(ps -p $NODE_PID -o rss | tail -n1 | tr -d ' ')
  MEM_MB=$(echo "scale=1; $MEM_KB / 1024" | bc)
  
  # Get uptime of the process
  PROC_START=$(ps -p $NODE_PID -o lstart= | xargs -0 date +%s -d)
  NOW=$(date +%s)
  UPTIME_SEC=$((NOW - PROC_START))
  
  # Format uptime nicely
  UPTIME_STR=$(printf '%02d:%02d:%02d' $(($UPTIME_SEC/3600)) $(($UPTIME_SEC%3600/60)) $(($UPTIME_SEC%60)))
  
  # Determine color for CPU and memory
  if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    CPU_COLOR=$RED
  elif (( $(echo "$CPU_USAGE > 50" | bc -l) )); then
    CPU_COLOR=$YELLOW
  else
    CPU_COLOR=$GREEN
  fi
  
  if (( $(echo "$MEM_MB > 200" | bc -l) )); then
    MEM_COLOR=$RED
  elif (( $(echo "$MEM_MB > 150" | bc -l) )); then
    MEM_COLOR=$YELLOW
  else
    MEM_COLOR=$GREEN
  fi
  
  return 0
}

# Function to get system details
get_system_details() {
  # Get system CPU usage
  SYS_CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}')
  
  # Get system memory info
  SYS_MEM_TOTAL=$(free -m | awk '/^Mem:/{print $2}')
  SYS_MEM_USED=$(free -m | awk '/^Mem:/{print $3}')
  SYS_MEM_PERCENT=$(echo "scale=1; $SYS_MEM_USED * 100 / $SYS_MEM_TOTAL" | bc)
  
  # Get temperature (Raspberry Pi specific)
  if [ -f /sys/class/thermal/thermal_zone0/temp ]; then
    TEMP=$(cat /sys/class/thermal/thermal_zone0/temp)
    TEMP_C=$(echo "scale=1; $TEMP / 1000" | bc)
    
    # Determine color for temperature
    if (( $(echo "$TEMP_C > 70" | bc -l) )); then
      TEMP_COLOR=$RED
    elif (( $(echo "$TEMP_C > 60" | bc -l) )); then
      TEMP_COLOR=$YELLOW
    else
      TEMP_COLOR=$GREEN
    fi
  else
    TEMP_C="N/A"
    TEMP_COLOR=$RESET
  fi
  
  # Determine system CPU color
  if (( $(echo "$SYS_CPU_USAGE > 80" | bc -l) )); then
    SYS_CPU_COLOR=$RED
  elif (( $(echo "$SYS_CPU_USAGE > 50" | bc -l) )); then
    SYS_CPU_COLOR=$YELLOW
  else
    SYS_CPU_COLOR=$GREEN
  fi
  
  # Determine system memory color
  if (( $(echo "$SYS_MEM_PERCENT > 80" | bc -l) )); then
    SYS_MEM_COLOR=$RED
  elif (( $(echo "$SYS_MEM_PERCENT > 50" | bc -l) )); then
    SYS_MEM_COLOR=$YELLOW
  else
    SYS_MEM_COLOR=$GREEN
  fi
}

# Initialize counter
counter=0

# Clear screen and display header
clear
echo -e "${BLUE}=== Aszune AI Bot Performance Monitor ===${RESET}"
echo -e "${BLUE}Press Ctrl+C to exit${RESET}"
echo ""

# Start monitoring loop
while [ $COUNT -lt 0 ] || [ $counter -lt $COUNT ]; do
  # Get current date and time
  DATETIME=$(date "+%Y-%m-%d %H:%M:%S")
  
  # Get process details
  get_process_details
  if [ $? -eq 0 ]; then
    get_system_details
    
    # Build the output message
    OUTPUT="[$DATETIME] Bot running for $UPTIME_STR"
    OUTPUT="$OUTPUT | Bot: CPU: ${CPU_COLOR}${CPU_USAGE}%${RESET}, Memory: ${MEM_COLOR}${MEM_MB}MB${RESET}"
    OUTPUT="$OUTPUT | System: CPU: ${SYS_CPU_COLOR}${SYS_CPU_USAGE}%${RESET}, Memory: ${SYS_MEM_COLOR}${SYS_MEM_USED}/${SYS_MEM_TOTAL}MB (${SYS_MEM_PERCENT}%)${RESET}"
    
    if [ "$TEMP_C" != "N/A" ]; then
      OUTPUT="$OUTPUT, Temp: ${TEMP_COLOR}${TEMP_C}°C${RESET}"
    fi
    
    # Display and optionally log the output
    echo -e "$OUTPUT"
    if [ "$LOG" = true ]; then
      echo "[$DATETIME] Bot: CPU: ${CPU_USAGE}%, Memory: ${MEM_MB}MB | System: CPU: ${SYS_CPU_USAGE}%, Memory: ${SYS_MEM_USED}/${SYS_MEM_TOTAL}MB (${SYS_MEM_PERCENT}%), Temp: ${TEMP_C}°C" >> "$LOG_FILE"
    fi
  fi
  
  # Increment counter
  counter=$((counter+1))
  
  # Wait for the specified interval
  if [ $COUNT -lt 0 ] || [ $counter -lt $COUNT ]; then
    sleep $INTERVAL
  fi
done

if [ "$LOG" = true ]; then
  echo -e "\n${GREEN}Performance data logged to $LOG_FILE${RESET}"
fi
