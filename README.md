# mongodb-proxy
> a node proxy for mongodb

![VERSION](https://img.shields.io/npm/v/mongodb-proxy.svg)
![DOWNLOADS](https://img.shields.io/npm/dt/mongodb-proxy.svg)
[![ISSUES](https://img.shields.io/github/issues-raw/akonoupakis/mongodb-proxy.svg)](https://github.com/akonoupakis/mongodb-proxy/issues)
[![BUILD](https://api.travis-ci.org/akonoupakis/mongodb-proxy.svg?branch=master)](http://travis-ci.org/akonoupakis/mongodb-proxy)
![LICENCE](https://img.shields.io/npm/l/mongodb-proxy.svg)

[![NPM](https://nodei.co/npm/mongodb-proxy.png?downloads=true)](https://nodei.co/npm/mongodb-proxy/)

## overview

A proxy and api pair, for mongo databases.<br />
A server side proxy is created given the database's schema and events configuration.<br />
The proxy is used to handle crud database operations filtered through the given events and therefore giving the option to halt on specific database actions as a firewall.

Have a look on the api documentation [here](https://cdn.rawgit.com/akonoupakis/mongodb-proxy/master/docs/jsdoc/index.html).

## usage

A few tutorials for you:

* [Getting started](https://cdn.rawgit.com/akonoupakis/mongodb-proxy/master/docs/jsdoc/tutorial-getting-started.html)
* [Register a collection](https://cdn.rawgit.com/akonoupakis/mongodb-proxy/master/docs/jsdoc/tutorial-register-collection.html)
* [Bind global events](https://cdn.rawgit.com/akonoupakis/mongodb-proxy/master/docs/jsdoc/tutorial-bind-global-events.html)
* [Set cache provider](https://cdn.rawgit.com/akonoupakis/mongodb-proxy/master/docs/jsdoc/tutorial-set-cache.html)
* [Using the mongodb driver](https://cdn.rawgit.com/akonoupakis/mongodb-proxy/master/docs/jsdoc/tutorial-using-mongodb-driver.html)
* [Expose the api](https://cdn.rawgit.com/akonoupakis/mongodb-proxy/master/docs/jsdoc/tutorial-expose-the-api.html)

## copyright and license

Code and documentation copyright 2015 akon. Code released under [the MIT license](https://cdn.rawgit.com/akonoupakis/mongodb-proxy/master/LICENSE).