/* global describe,it */

var assert = require('assert')
var Scrubber = require('../lib/Scrubber.js')
var uuid = require('../lib/uuid.js')

var _ = require('underscore')

describe('Scrubber', function () {
  var scrubber = new Scrubber()

  describe('Scrubber.inbound', function () {
    var testObj = {
      id: '56b7e686481a44b832f130c7',
      title: 'test',
      testId: '56b7e69f481a44b832f1313d',
      collectionOfIds: ['56857190f7c6ae3434567828', '56857190f7c6ae343456782a'],
      collectionOfObjects: [{
        id: '56857190f7c6ae343456782b',
        title: 'test1',
        testId: '56b7e69f481a44b832f1313f'
      }, {
        id: '56857190f7c6ae343456782c',
        title: 'test2',
        testId: '56b7e69f481a44b832f13142'
      }],
      subObject: {
        id: '56857190f7c6ae343456782d',
        title: 'test',
        testId: '56b7e69f481a44b832f13143',
        collectionOfIds: ['56857190f7c6ae343456782e', '56857190f7c6ae343456782f'],
        collectionOfObjects: [{
          id: '56857190f7c6ae3434567831',
          title: 'test1',
          testId: '56b7e69f481a44b832f13144'
        }, {
          id: '56912c576a0e753039a16a6d',
          title: 'test2',
          testId: '56e36ea47473f9c804537d4c'
        }]
      }
    }

    scrubber.inbound(testObj)

    it('replaced property names from "id" to "_id"', function () {
      assert.equal(true, testObj._id !== undefined)
      assert.equal(true, _.all(testObj.collectionOfObjects, function (x) { return x._id !== undefined }))
      assert.equal(true, testObj.subObject._id !== undefined)
      assert.equal(true, _.all(testObj.subObject.collectionOfObjects, function (x) { return x._id !== undefined }))
    })

    it('removed properties named "id"', function () {
      assert.equal(true, testObj.id === undefined)
      assert.equal(true, _.all(testObj.collectionOfObjects, function (x) { return x.id === undefined }))
      assert.equal(true, testObj.subObject.id === undefined)
      assert.equal(true, _.all(testObj.subObject.collectionOfObjects, function (x) { return x.id === undefined }))
    })

    var isObjectId = function (x) {
      return typeof (x) === 'object' && x.toString && x.toString().length === 24
    }

    it('converted ids to mongo objectIds', function () {
      assert.equal(true, isObjectId(testObj._id))
      assert.equal(true, isObjectId(testObj.testId))
      assert.equal(true, _.all(testObj.collectionOfIds, function (x) { return isObjectId(x) }))
      assert.equal(true, _.all(_.pluck(testObj.collectionOfObjects, '_id'), function (x) { return isObjectId(x) }))
      assert.equal(true, _.all(_.pluck(testObj.collectionOfObjects, 'testId'), function (x) { return isObjectId(x) }))
      assert.equal(true, isObjectId(testObj.subObject._id))
      assert.equal(true, isObjectId(testObj.subObject.testId))
      assert.equal(true, _.all(testObj.subObject.collectionOfIds, function (x) { return isObjectId(x) }))
      assert.equal(true, _.all(_.pluck(testObj.subObject.collectionOfObjects, '_id'), function (x) { return isObjectId(x) }))
      assert.equal(true, _.all(_.pluck(testObj.subObject.collectionOfObjects, 'testId'), function (x) { return isObjectId(x) }))
    })
  })

  describe('Scrubber.outbound', function () {
    var testObj = {
      _id: uuid.create('56b7e686481a44b832f130c7'),
      title: 'test',
      testId: uuid.create('56b7e69f481a44b832f1313d'),
      collectionOfIds: [uuid.create('56857190f7c6ae3434567828'), uuid.create('56857190f7c6ae343456782a')],
      collectionOfObjects: [{
        _id: uuid.create('56857190f7c6ae343456782b'),
        title: 'test1',
        testId: uuid.create('56b7e69f481a44b832f1313f')
      }, {
        _id: uuid.create('56857190f7c6ae343456782c'),
        title: 'test2',
        testId: uuid.create('56b7e69f481a44b832f13142')
      }],
      subObject: {
        _id: uuid.create('56857190f7c6ae343456782d'),
        title: 'test',
        testId: uuid.create('56b7e69f481a44b832f13143'),
        collectionOfIds: [uuid.create('56857190f7c6ae343456782e'), uuid.create('56857190f7c6ae343456782f')],
        collectionOfObjects: [{
          _id: uuid.create('56857190f7c6ae3434567831'),
          title: 'test1',
          testId: uuid.create('56b7e69f481a44b832f13144')
        }, {
          _id: uuid.create('56912c576a0e753039a16a6d'),
          title: 'test2',
          testId: uuid.create('56e36ea47473f9c804537d4c')
        }]
      }
    }

    scrubber.outbound(testObj)

    it('replaced property names from "_id" to "id"', function () {
      assert.equal(true, testObj.id !== undefined)
      assert.equal(true, _.all(testObj.collectionOfObjects, function (x) { return x.id !== undefined }))
      assert.equal(true, testObj.subObject.id !== undefined)
      assert.equal(true, _.all(testObj.subObject.collectionOfObjects, function (x) { return x.id !== undefined }))
    })

    it('removed properties named "_id"', function () {
      assert.equal(true, testObj._id === undefined)
      assert.equal(true, _.all(testObj.collectionOfObjects, function (x) { return x._id === undefined }))
      assert.equal(true, testObj.subObject._id === undefined)
      assert.equal(true, _.all(testObj.subObject.collectionOfObjects, function (x) { return x._id === undefined }))
    })

    var isObjectIdString = function (x) {
      return typeof (x) === 'string' && x.length === 24
    }

    it('converted mongo objectIds to stringified ids', function () {
      assert.equal(true, isObjectIdString(testObj.id))
      assert.equal(true, isObjectIdString(testObj.testId))
      assert.equal(true, _.all(testObj.collectionOfIds, function (x) { return isObjectIdString(x) }))
      assert.equal(true, _.all(_.pluck(testObj.collectionOfObjects, 'id'), function (x) { return isObjectIdString(x) }))
      assert.equal(true, _.all(_.pluck(testObj.collectionOfObjects, 'testId'), function (x) { return isObjectIdString(x) }))
      assert.equal(true, isObjectIdString(testObj.subObject.id))
      assert.equal(true, isObjectIdString(testObj.subObject.testId))
      assert.equal(true, _.all(testObj.subObject.collectionOfIds, function (x) { return isObjectIdString(x) }))
      assert.equal(true, _.all(_.pluck(testObj.subObject.collectionOfObjects, 'id'), function (x) { return isObjectIdString(x) }))
      assert.equal(true, _.all(_.pluck(testObj.subObject.collectionOfObjects, 'testId'), function (x) { return isObjectIdString(x) }))
    })
  })
})
