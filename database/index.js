/*
 * AWS Lambda function that processes events triggered by S3 to update a DynamoDB index.
 * (Inspired by aws-blog-s3-index-with-lambda-ddb)
 */

// Note: renaming objects triggers both ObjectCreated and ObjectRemoved.
const REMOVE_EVENT = 'ObjectRemoved';
const CREATE_EVENT = 'ObjectCreated';

var AWS = require('aws-sdk');
var s3 = new AWS.S3('2006-03-01');
var dynamodb = new AWS.DynamoDB.DocumentClient('2012-08-10');

// TODO: test... generate events and use localdynamo
/*
function defaultCallback(err, data) {
    if (err) context.done('Error updating index:' + err);
    else context.done();
}
*/

// Update item, or insert if already exists
function upsert(params, key, itemIsMain, context) {

    if (itemIsMain) {
        params.ExpressionAttributeValues[":key"] = key;
        params.UpdateExpression = 'SET itemurl = :key';
    } else {
        params.ExpressionAttributeValues[":key"] = dynamodb.createSet([key]);
        params.UpdateExpression = 'ADD alturls :key';
    }

    dynamodb.update(params, function(err, data) {
        if (err) context.done('Error updating index:' + err);
        else context.done();
    });
}

// Remote item attribute, or whole item if all related S3 objects are gone
function remove(params, key, itemIsMain, context) {

    if (itemIsMain) {
        params.UpdateExpression = 'REMOVE itemurl';
    } else {
        params.ExpressionAttributeValues[":key"] = dynamodb.createSet([key]);
        params.UpdateExpression = 'DELETE alturls :key';
    }

    var itemIsEmpty = false;
    params.ReturnValues = 'ALL_NEW';

    // Update and check state of index item
    dynamodb.update(params, function(err, data){
        if (err) {
            context.done('Error updating index:' + err);
        } else {
            var item = data.Attributes;
            if (item) itemIsEmpty = !('itemurl' in item) && !('alturls' in item);
        }
    });

    // Delete item if all related s3 objects are gone
    if (itemIsEmpty) dynamodb.delete(params, function(err, data) {
        if (err) context.done('Error updating index:' + err);
        else context.done();
    });
}

// Parse event information
function updateIndex(eventType, bucket, key, context) {
    /*
     * Naming conventions:
     *
     * table/category/name/filename
     * or
     * table/category/filename
     *
     * 0filename means filename is main file for this object
     * #filename, other numbers indicate alt files
     */

    var tokens = key.split('/');

    // Ignore folder events and invalid paths
    if ((key.charAt(key.length-1) == '/') || (tokens.length < 3)) {
        context.done('Ignoring event');
        return;
    }

    var itemTable = tokens[0];
    var itemCategory = tokens[1];
    var itemName = tokens[2]; // TODO: get name from elsewhere
    var itemIsMain = true;

    if (tokens.length == 4) {
        itemIsMain  = (tokens[3][0] == '0');
    } else {
        // Remove file extension from name
        itemName = itemName.split('.')[0];
    }

    var params = {
        TableName: itemTable,
        Key: {
            category: itemCategory,
            name: itemName
        },
        ExpressionAttributeValues: {}
    };

    if (eventType.includes(CREATE_EVENT)) upsert(params, key, itemIsMain, context);
    else if (eventType.includes(REMOVE_EVENT)) remove(params, key, itemIsMain, context);
}

// Entry point
exports.handler = function(event, context) {
    var record = event.Records[0];
    var eventType = record.eventName;
    var object = record.s3.object;
    var bucket = record.s3.bucket.name;

    // TODO: process events in batches???
    // TODO: update object in s3 to replace spaces with underscores (check that name is available)
    var key = decodeURIComponent(object.key.replace(/\+/g, ' '));

    console.log(eventType + ': ' + bucket + '/' + key);

    try {
        updateIndex(eventType, bucket, key, context);
    } catch(err) {
        context.done('Exception thrown: ' + err);
    }
};
