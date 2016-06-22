var registeredDevice = require('./models/registeredDevice.js');
var notificationLog = require('./models/notifications.js');
var FCM = require('fcm-node');
var config = require('./config.js');
var fcm = new FCM(config.ServerKey);
var winston = require('winston');
 var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)(),
      new (winston.transports.File)({

      filename: 'fileLog.log'
    })
 
    ]
  });

module.exports = {
    addDevice: function (userId, deviceToken, deviceType, callback) {
        registeredDevice.find({ userId: userId, deviceToken: deviceToken }, function (err, devices) {
            if (err) {
                callback({ 'message': 'internal server error', 'status': 500, 'data': null }, null);
                logger.log('error',{ 'message': 'internal server error', 'status': 500 });
            }
            else if (devices.length > 0) {
                callback(null, { 'message': 'user and device already registered', 'status': 409, 'data': null });
                logger.log('info', { 'message': 'user and device already registered', 'status': 409 });
            }
            else {

                var device = new registeredDevice(
                    {
                        userId: userId,
                        deviceToken: deviceToken,
                        deviceType: deviceType,
                        isNotificationsEnabled: true
                    }
                );

                device.save(function (err) {
                    if (err){
                         callback({ 'message': 'internal server error', 'status': 500, 'data': null }, null);
                          logger.log('error',{ 'message': 'internal server error while adding the ', 'status': 500 });
                        }
                    else {
                        callback(null, { "message": "user device added  successfully", 'status': 201, 'data': null });
                         logger.log('info', { 'message': 'user device added  successfully', 'status': 201 });
                    }
                });
            }


        });
    },
    unSubscribeUser: function (userId, callback) {
        registeredDevice.remove({ userId: userId }, function (err, records) {
            if (err) {
                callback({ 'message': 'internal server error', 'status': 500, 'data': null }, null);
                 logger.log('error',{ 'message': 'internal server error', 'status': 500});
            }
            else if (records.result.n == 0) {
                callback(null, { 'message': 'No user exists', 'status': 404});
                  logger.log('info',{ 'message': 'No user exists', 'status': 404});
            }
            else {
                callback(null, { "message": "user unsubscribed", 'status': 200, 'data': records.result.n + " user devices unsubscribed" });
                  logger.log('info',{ 'message': 'user unsubscribed', 'status': 200});
            }
        });

    },
    unSubscribeDevice: function (deviceToken, callback) {
        registeredDevice.remove({ deviceToken: deviceToken }, function (err, records) {
            if (err) {
                callback({ 'message': 'internal server error', 'status': 500, 'data': null }, null);
                logger.log('error',{ 'message': 'internal server error', 'status': 500});
            }
            else if (records.result.n == 0) {
                callback(null, { 'message': 'No user device exists', 'status': 404, 'data': 'please enter a registered device token' });
                   logger.log('info',{ 'message': 'No user device exists', 'status': 404});
            }
            else {
                callback(null, { "message": "device unsubscribed", 'status': 200, 'data': " user device unsubscribed successfully" });
                 logger.log('info',{ 'message': 'device unsubscribed', 'status': 200});
            }
        });
    },
    sendFcmPushNotificationToUsers: function (recieverUserIds, message, senderUserId, callback) {
        var deviceTokens = [];
        registeredDevice.find({ userId: { $in: recieverUserIds },isNotificationsEnabled:true }, function (err, devices) {
            if (err) {
                callback({ 'message': 'some error occured', 'status': 500, 'data': err }, null);
                 logger.log('error',{ 'message': 'internal server error', 'status': 500});
            }
            else if (devices.length == 0) {
                callback({ 'message': "no device exists", 'status': 404, 'data': null }, null);
                 logger.log('info',{ 'message': 'No user device exists', 'status': 404});
            }
            else {
                for (var k = 0; k < devices.length; k++) {
                    deviceTokens.push(devices[k].deviceToken);
                }
                var Message = {
                    registration_ids: deviceTokens,
                    priority: 'high',
                    content_available: true,
                    delay_while_idle: true,
                    time_to_live: 86400,
                    data: {
                        data: 'this is a firebase notification sent by ' + senderUserId + ' on ' + Date.now(),
                        message: message
                    },
                    notification: {
                        title: 'Hi you just recieved a message',
                        body: 'You have notification from ' + senderUserId,
                        icon: 'ic_launcher', //now required
                        sound: ''
                    }
                };
                fcm.send(Message, function (err, response) {
                    if (!err.includes("success")) {
                        callback({ 'message': "something has gone wrong", 'status': 500, 'data': err }, null);
                          logger.log('error',{ 'message': 'internal server error while sending fcm', 'status': 500});
                    }
                    else {
                        var newNotification = new notificationLog({
                            message: message,
                            senderUserId: senderUserId,
                            recieverUserId: recieverUserIds

                        });
                        newNotification.save(function (err) {
                        });
                        callback(null, { 'message': "notification successfully sent ", 'status': 200, 'data': null });
                         logger.log('info',{ 'message': 'notification successfully sent', 'status': 200});
                    }

                });
            }
        });




    },
    sendFcmBroadcastPushNotifications: function (message, senderUserId, callback) {
        registeredDevice.find({ userId: { $ne: senderUserId }, isNotificationsEnabled: true }, function (err, devices) {
            if (err) {
                callback({ 'message': 'something has gone wrong', 'status': 500, 'data': null }, null);
                 logger.log('error',{ 'message': 'internal server error', 'status': 500});
            }
            else if (devices.length == 0) {
                callback(null, { 'message': 'no devices exists to send broadcast', 'status': 404, 'data': null });
                 logger.log('info',{ 'message': 'No user device exists to send broadcast', 'status': 404});
            }
            else {
                var deviceTokens = [];
                var recieverUserIds = [];
                for (var i = 0; i < devices.length; i++) {
                    deviceTokens.push(devices[i].deviceToken);
                    recieverUserIds.push(devices[i].userId);
                }
                var recieverUserIdsUnique = recieverUserIds.unique();
                var Message = {
                    registration_ids: deviceTokens,
                    priority: 'high',
                    delay_while_idle: true,
                    time_to_live: 86400,
                    data: {
                        data: 'this is a firebase broadcast notification',
                        message: message
                    },
                    notification: {
                        title: 'Firebase',
                        body: message,
                        icon: 'ic_launcher' //now required
                    }
                };
                fcm.send(Message, function (err, response) {
                    if (!err.includes("success")) {
                        callback({ 'message': "something has gone wrong", 'status': 500, 'data': err }, null);
                         logger.log('error',{ 'message': 'internal server error while sending fcm broadcast', 'status': 500});
                    }
                    else {

                        var newNotification = new notificationLog({
                            message: message,
                            senderUserId: senderUserId,
                            recieverUserId: recieverUserIdsUnique
                        });
                        newNotification.save(function (err) {
                        });
                        callback(null, { 'message': "notification successfully sent ", 'status': 200, 'data': null });
                          logger.log('info',{ 'message': 'notification successfully sent', 'status': 200});
                    }

                });
            }
        });
    },
    showNotifications: function (userId, callback) {
        notificationLog.find({ recieverUserId: { $in: [userId] }, checked: false }, function (err, notifications) {
            if (err) {
                callback({ 'message': 'internal server error', 'status': 500, 'data': null }, null);
                 logger.log('error',{ 'message': 'internal server error', 'status': 500});
            }
            else if (notifications.length == 0) {
                callback(null, { 'message': 'no new notifications found', 'status': 404, 'data': null });
                 logger.log('info',{ 'message': 'no new notifications found', 'status': 404});
            }
            else {
                notificationLog.update({ recieverUserId: { $in: [userId] }, checked: false }, { $set: { checked: true } }, { multi: true },
                    function (err, noOfAffectedDocuments) { });
                callback(null, { 'message': notifications.length + ' new notifications found', 'status': 200, 'data': notifications });
                 logger.log('info',{ 'message': notifications.length + ' new notifications found', 'status': 200});
                
            }
        });
    },
    deleteNotifications: function (notificationIdArray, callback) {
        notificationLog.remove({ _id: { $in: notificationIdArray } }, function (err, no) {
            if (err) {
                callback({ 'message': err.message, 'status': 500, 'data': 'enter valid notification ids' }, null);
                  logger.log('error',{ 'message': 'internal server error/enter valid notification ids', 'status': 500});
            }
            else if (no.result.n == 0) {
                callback(null, { 'message': 'no  notifications found to delete', 'status': 404, 'data': null });
                 logger.log('info',{ 'message': 'no new notifications found to delete', 'status': 404});
            }
            else {
                callback(null, { 'message': no.result.n + " records deleted", 'status': 200, 'data': null });
                 logger.log('info',{ 'message':  no.result.n + " records deleted", 'status': 200});
            }

        });
    },
    disableNotifications: function (deviceToken, callback) {
        registeredDevice.update({ deviceToken: deviceToken, isNotificationsEnabled: true }, { $set: { isNotificationsEnabled: false } }, { multi: true }, function (err, no) {
            if (err) {
                callback({ 'message': 'Something has gone wrong', 'status': 500, 'data': 'enter valid device token' }, null);
            }
            else if (no.nModified == 0) {
                callback(null, { 'message': 'notification already disabled or device not exist', 'status': 404, 'data': null });
            }
            else {
                callback(null, { 'message': "notification disabled on this device", 'status': 200, 'data': null });
            }
        });
    },
    enableNotifications: function (deviceToken, callback) {
        registeredDevice.update({ deviceToken: deviceToken, isNotificationsEnabled: false }, { $set: { isNotificationsEnabled: true } }, { multi: true }, function (err, no) {
            if (err) {
                callback({ 'message': 'Something has gone wrong', 'status': 500, 'data': 'enter valid device token' }, null);
            }
            else if (no.nModified == 0) {
                callback(null, { 'message': 'notification already enabled or device not exist', 'status': 404, 'data': null });
            }
            else {
                callback(null, { 'message': "notification enabled on this device", 'status': 200, 'data': null });
            }
        });
    },
    deleteAllNotifications: function (userId, callback) {
        notificationLog.remove({ recieverUserId: { $in: [userId] } }, function (err, no) {
            if (err) {
                callback({ 'message': err.message, 'status': 500, 'data': 'enter valid notification ids' }, null);
                 logger.log('error',{ 'message': 'internal server error/enter valid notification ids', 'status': 500});
            }
            else if (no.result.n == 0) {
                callback(null, { 'message': 'no  notifications found to delete', 'status': 404, 'data': null });
                 logger.log('info',{ 'message': 'no new notifications found to delete', 'status': 404});
            }
            else {
                callback(null, { 'message': no.result.n + " records deleted", 'status': 200, 'data': null });
                 logger.log('info',{ 'message':  no.result.n + " records deleted", 'status': 200});
            }

        });
    }

};


Array.prototype.contains = function (v) {
    for (var i = 0; i < this.length; i++) {
        if (this[i] === v) return true;
    }
    return false;
};

Array.prototype.unique = function () {
    var arr = [];
    for (var i = 0; i < this.length; i++) {
        if (!arr.contains(this[i])) {
            arr.push(this[i]);
        }
    }
    return arr;
}