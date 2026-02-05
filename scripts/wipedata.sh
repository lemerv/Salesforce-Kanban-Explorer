#!/bin/bash
# wipedata.sh - Deletes records from Account, Contact, Case, Opportunity, Project__c, Project_Task__c
# WARNING: This will delete ALL records in these objects

APEX_FILE="scripts/apex/wipedata.apex"

# Check if sf CLI is installed
if ! command -v sf &> /dev/null; then
    echo "sf CLI not found. Please install it first."
    exit 1
fi

# Check if apex file exists
if [ ! -f "$APEX_FILE" ]; then
    echo "Apex file $APEX_FILE not found!"
    exit 1
fi

# Get current org details
ORG_INFO=$(sf org display --json)

CURRENT_USERNAME=$(echo "$ORG_INFO" | jq -r '.result.username')
CURRENT_ALIAS=$(echo "$ORG_INFO" | jq -r '.result.alias')
INSTANCE_URL=$(echo "$ORG_INFO" | jq -r '.result.instanceUrl')

# Abort if not a scratch org
if [[ "$INSTANCE_URL" != *".scratch.my.salesforce.com"* ]]; then
    echo "ERROR: This script can only be run against scratch orgs."
    echo "Current org ($CURRENT_USERNAME) instance URL: $INSTANCE_URL"
    exit 1
fi

# Ask for confirmation
echo "You are about to DELETE ALL records for Account, Contact, Case, Opportunity, Project__c, Project_Task__c"
echo "Target Org Username: $CURRENT_USERNAME"
if [ "$CURRENT_ALIAS" != "null" ] && [ -n "$CURRENT_ALIAS" ]; then
    echo "Target Org Alias: $CURRENT_ALIAS"
fi

read -p "Are you sure you want to continue? Type 'YES' to proceed: " CONFIRMATION

if [ "$CONFIRMATION" != "YES" ]; then
    echo "Operation cancelled."
    exit 0
fi

# Run the Apex script
echo "Running wipe script against org: $CURRENT_USERNAME ..."
sf apex run --target-org "$CURRENT_USERNAME" --file "$APEX_FILE"

# Check exit code
if [ $? -eq 0 ]; then
    echo "Records deleted successfully."
else
    echo "Error running Apex script."
    exit 1
fi
