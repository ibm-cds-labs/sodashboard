#!/bin/bash

# Creates a new database called "events" and migrates the 
# permissions from the "questions" database to the new database.
# Expects an environment variable called CLOUDANT_URL containing
# the authenticated URL of the Cloudant service e.g.
# export CLOUDANT_URL="https://U:P@myhost.cloudant.com"
if [ -z ${CLOUDANT_URL+x} ]; then echo 'Error: Environment variable CLOUDANT_URL is undefined.'; exit 1; fi

# create the new database
echo "Creating the database"
curl -X PUT "${CLOUDANT_URL}/events"

# read permissions from the questions database
echo "Reading the permissions"
PERM=`curl -X GET "${CLOUDANT_URL}/questions/_security"`

# writing permissions to the events database
echo "Writing permissons"
curl -X PUT -H "Content-type: application/json" -d "$PERM" "${CLOUDANT_URL}/events/_security"