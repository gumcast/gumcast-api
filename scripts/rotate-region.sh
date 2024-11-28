#!/bin/bash

set -e

APP_NAME="gumcast-api"
echo "App Name: $APP_NAME"

OLD_REGIONS=$(flyctl regions list | grep 'Regions \[app\]:' | sed -n 's/Regions \[app\]: //p' | tr ',' '\n' | xargs)
echo "OLD_REGIONS=$OLD_REGIONS"

# Ordered list of regions
REGIONS=("lax" "sea" "bos" "dfw" "den" "ewr" "iad" "ord" "sjc")
echo "REGIONS=${REGIONS[@]}"

# Check if REGIONS is empty
if [ ${#REGIONS[@]} -eq 0 ]; then
  echo "No regions defined. Exiting."
  exit 1
fi

# If no old regions are found, bring up a machine in the first region
if [ -z "$OLD_REGIONS" ]; then
  echo "No old regions found. Bringing up a machine in the first region: ${REGIONS[0]}"
  flyctl scale count --region ${REGIONS[0]} 1 --yes
  exit 0
fi

# Find the next region in REGIONS after the last region in OLD_REGIONS
echo "Determining the next region to scale up..."
NEXT_REGION=""
FOUND=false
for REGION in "${REGIONS[@]}"; do
  # Check if the region is in OLD_REGIONS
  if [[ "$FOUND" == true && ! " $OLD_REGIONS " =~ " $REGION " ]]; then
    NEXT_REGION=$REGION
    break
  fi

  # Mark FOUND when a region from OLD_REGIONS is seen in REGIONS
  if [[ " $OLD_REGIONS " =~ " $REGION " ]]; then
    FOUND=true
  fi
done

# If we didn’t find a NEXT_REGION due to wrap-around, start from the beginning of REGIONS
if [ -z "$NEXT_REGION" ]; then
  for REGION in "${REGIONS[@]}"; do
    if [[ ! " $OLD_REGIONS " =~ " $REGION " ]]; then
      NEXT_REGION=$REGION
      break
    fi
  done
fi

# Log the selected NEXT_REGION
echo "NEXT_REGION=$NEXT_REGION"

# Validate NEXT_REGION
if [ -z "$NEXT_REGION" ]; then
  echo "No new region found. Exiting."
  exit 1
fi

# Scale the next region to 1
echo "Scaling up region: $NEXT_REGION"
flyctl scale count --region $NEXT_REGION 1 --yes

# Wait for the new region to be ready (optional, add more robust logic as needed)
echo "Waiting for $NEXT_REGION to be ready..."
sleep 60

# Scale down all old regions
echo "Scaling down old regions..."
for REGION in $OLD_REGIONS; do
  echo "Scaling down region: $REGION"
  flyctl scale count --region $REGION 0 --yes
done
