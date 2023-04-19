# Kolektivo Monetary Services

## Overview

## Build

`npm run build`

Writes typescript to the dist folder

## Get ABIs from Monetary Contracts repo

`npm run fetchAbis`

Writes abi files to src/abis.

The repo kolektivo-monetary-contracts must be sibling to this one for the script to find the abi files.

## Deploy

`npm run deploy`

Copies abi files to the dist folder.  Invokes defender-client APIs to zip up the code and send it to the Autotask code snippet in Defender.

## Run Locally

Create a .env file:

  API_KEY=
  API_SECRET=
  API_KEY_TEAM=
  API_SECRET_TEAM=
  COINGECKO_API_KEY=

`npm run start`
