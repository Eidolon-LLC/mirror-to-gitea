#!/usr/bin/env bash

docker image build -t docker.eidoloncorp.com/eidolon/mirror-to-gitea:latest .
docker push docker.eidoloncorp.com/eidolon/mirror-to-gitea:latest
