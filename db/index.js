/*
 * Process events triggered by S3 and update DynamoDB index.
 * Inspired by aws-blog-s3-index-with-lambda-ddb.
 *
 */

var AWS = require('aws-sdk');
var s3 = new AWS.S3('2006-03-01');
var dynamodb = new AWS.DynamoDB('2012-08-10').DocumentClient();


function updateIndex(eventType, bucket, key) {
    //TODO: check if main image, will have underscore as first character of filename
    // keyregex?

    // oeuvres/sculpture/transe/main.jpg
    // table/category/name/filename
    // table/category/filename
    var table = key.substring(0, key.indexOf('/')); //match[0]
    var category;
    // TODO: get name from elsewhere
    var name;

    var params = {
        TableName: table,
        Item: {
            //
            category: match[1],
            name: match[2], // if no match 2, grab filename and no alturls
            url: key,
            alturls: ...
        }
    };

    dynamodb.put(params, function(err, data){
        if (err) {
            context.done("Error adding index item to " + table + "\n" + err);
        } else {
            context.done();
        }
        return;
    });
    // TODO: update, delete. use this same module for both create and delete s3 trigger events
    // confirm that renaming triggers a create event AND a delete event for the old name
}

exports.handler = function(event, context) {
    var record = event.Records[0];
    var eventType = record.eventName;
    var object = record.s3.object;
    var bucket = record.s3.bucket.name;

    // TODO: update object in s3 to replace spaces with underscores
    var key = decodeURIComponent(object.key.replace(/\+/g, " "));

    console.log("Indexing " + bucket + "/" + key);

    try {
        updateIndex(eventType, bucket, key);
    } catch(err) {
        context.done("Exception thrown: " + err);
        return;
    }
};
