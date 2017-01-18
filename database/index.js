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

// TODO: test...

// CASES always use update?
// single:
//  rm-> del
//  cr-> SET url = :i
// multi:
//  rm->
//      main-> SET url = alturls[0], REMOVE alturls[0] if alturls exists | use returnvals all_new or error code to del if empty alts
//      alt-> REMOVE alturls[:n]
//  cr->
//      main-> SET url = :i
//      alt-> SET alturls = list_append(alturls, :il), url = if_not_exists(url, :i)

function updateIndex(eventType, bucket, key) {
    /*
     * Naming conventions:
     *
     * table/category/name/filename
     * or
     * table/category/filename
     *
     * 0filename means filename is main file for this object
     * #filename, other numbers indicate alt file clockwise
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
    var itemUrl = key;
    var isMain = true;

    if (tokens.length == 4) {
        isMain = (tokens[3][0] == '0');
    } else {
        // Remove file extension from name
        itemName = itemName.split('.')[0];
    }

    var params = {
        TableName: itemTable,
        Key: {
            category: itemCategory,
            name: itemName
        }
    };

    if (eventType.includes(CREATE_EVENT)) {
        params.UpdateExpression = 'set ...';
        params.ExpressionAttributeValues = {
                "url": '',
                "alturls": []
        };
        dynamodb.update(params, function(err, data){
            if (err) {
                context.done('Error updating index item to ' + itemTable + '\n' + err);
            } else {
                context.done();
            }
            return;
        });
    } else if (eventType.includes(REMOVE_EVENT)) {
        // TODO: MIGHT STILL WANT TO USE UPDATE EG: JUST DELETING AN ALT IMAGE
        dynamodb.delete(params, function(err, data){
            if (err) {
                context.done('Error removing index item from ' + itemTable + '\n' + err);
            } else {
                context.done();
            }
            return;
        });
    }
}

exports.handler = function(event, context) {
    var record = event.Records[0];
    var eventType = record.eventName;
    var object = record.s3.object;
    var bucket = record.s3.bucket.name;

    // TODO: process events in batches???
    // TODO: update object in s3 to replace spaces with underscores (check that name is available)
    var key = decodeURIComponent(object.key.replace(/\+/g, ' '));

    console.log(eventType + ': ' + bucket + '/' + key);

    //try {
        //updateIndex(eventType, bucket, key);
    //} catch(err) {
        //context.done('Exception thrown: ' + err);
        //return;
    //}
};