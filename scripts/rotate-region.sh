APP_NAME="gumcast-api"
OLD_REGION=$(flyctl regions list | grep 'Regions \[app\]:' | awk '{print $3}')

# Ordered list of regions
REGIONS=("lax" "sea" "bos" "dfw" "den" "ewr" "iad" "ord" "sjc")

# Check if REGIONS is empty
if [ ${#REGIONS[@]} -eq 0 ]; then
  echo "No regions defined. Exiting."
  exit 1
fi

# If OLD_REGION is empty, bring up a machine in the first region
if [ -z "$OLD_REGION" ]; then
  echo "No old region found. Bringing up a machine in the first region: ${REGIONS[0]}"
  flyctl scale count --region ${REGIONS[0]} 1 --yes
  exit 0
fi

# Find the next region
NEW_REGION=""
for i in "${!REGIONS[@]}"; do
  if [[ "${REGIONS[$i]}" == "$OLD_REGION" ]]; then
    NEW_REGION=${REGIONS[$(( (i + 1) % ${#REGIONS[@]} ))]}
    break
  fi
done

# Check if NEW_REGION is empty or the same as OLD_REGION
if [ -z "$NEW_REGION" ] || [ "$NEW_REGION" == "$OLD_REGION" ]; then
  echo "No new region found or it's the same as the old region. Exiting."
  exit 1
fi

# Scale the new region to 1
flyctl scale count --region $NEW_REGION 1 --yes

# Wait for the new region to be ready (optional, add more robust logic as needed)
sleep 60

# Scale the old region to 0
flyctl scale count --region $OLD_REGION 0 --yes
