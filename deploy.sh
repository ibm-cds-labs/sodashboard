#!/bin/bash

wget https://clis.ng.bluemix.net/download/bluemix-cli/0.6.1/linux64
mv linux64 Bluemix_CLI.tar.gz
tar -xzvf Bluemix_CLI.tar.gz
cd Bluemix_CLI
sudo ./install_bluemix_cli
bx --version

