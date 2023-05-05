# Kolektivo Monetary Services

## Overview

## Build

`npm run build`

Writes dev typescript to the dist folder, using test ABIs and keys from a ".env" file.

`npm run build-prod`

Does the same but with production ABIs and using keys from a ".env.production" file.

## Get ABIs from Monetary Contracts repo

`npm run fetchAbis`

Writes abi files to src/abis.

The repo kolektivo-monetary-contracts Github repository must be sibling to this one for the script to find the abi files.

## Deploy

`npm run deploy`

Copies test ABI files to the dist folder.  Invokes defender-client APIs to zip up the code and send it to the Autotask code snippet in Defender.

`npm run deploy-prod`

Does the same but with production ABIs and using keys from a ".env.production" file.

## Run Locally

Create a ".env" file for a development build:

  API_KEY=
  API_SECRET=
  API_KEY_TEAM=
  API_SECRET_TEAM=
  COINGECKO_API_KEY=

And another for a production built as ".env.production".

`npm run start`
