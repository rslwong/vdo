#!/bin/bash

myip=$(ipconfig getifaddr en0)
docker run --rm -p 3000:3000 -p 3443:3443 -e HOST_IP=${myip} vdo-share

