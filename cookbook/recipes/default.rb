#
# Cookbook Name:: runnable_api-server
# Recipe:: default
#
# Copyright 2014, Runnable.com
#
# All rights reserved - Do Not Redistribute
#

include_recipe 'runnable_api-server::dependencies'
include_recipe 'runnable_api-server::deploy_ssh'
include_recipe 'runnable_api-server::deploy'