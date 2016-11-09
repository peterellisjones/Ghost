var ExpressBrute = require('express-brute'),
    BruteKnex = require('brute-knex'),
    knexInstance = require('../../data/db/connection'),
    store = new BruteKnex({tablename: 'brute', createTable:false, knex: knexInstance}),
    moment = require('moment'),
    errors = require('../../errors'),
    config = require('../../config'),
    spam = config.get('spam') || {},
    _ = require('lodash'),
    spamPrivateBlog = spam.private_blog || {},
    spamGlobalBlock = spam.global_block || {},
    spamGlobalReset = spam.global_reset || {},
    spamUserReset = spam.user_reset || {},
    spamUserLogin = spam.user_login || {},

    i18n = require('../../i18n'),
    handleStoreError,
    globalBlock,
    globalReset,
    privateBlog,
    userLogin,
    userReset,
    logging = require('../../logging'),
    spamConfigKeys = ['freeRetries', 'minWait', 'maxWait', 'lifetime'];

// weird, but true
handleStoreError = function handleStoreError(err) {
    err.next(new errors.NoPermissionError({
        message: 'Unknown error',
        err: err.parent ? err.parent : err
    }));
};

// This is a global endpoint protection mechanism that will lock an endpoint if there are so many
// requests from a single IP
// We allow for a generous number of requests here to prevent communites on the same IP bing barred on account of a single suer
// Defaults to 50 attempts per hour and locks the endpoint for an hour
globalBlock = new ExpressBrute(store,
    _.extend({
        attachResetToRequest: false,
        failCallback: function (req, res, next, nextValidRequestDate) {
            return next(new errors.TooManyRequestsError({
                message: 'Too many attempts try again in ' + moment(nextValidRequestDate).fromNow(true),
                context: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.error',
                    {rfa: spamGlobalBlock.freeRetries + 1 || 5, rfp: spamGlobalBlock.lifetime || 60 * 60}),
                help: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.context')
            }));
        },
        handleStoreError: handleStoreError
    }, _.pick(spamGlobalBlock, spamConfigKeys))
);

globalReset = new ExpressBrute(store,
    _.extend({
        attachResetToRequest: false,
        failCallback: function (req, res, next, nextValidRequestDate) {
            // TODO use i18n again
            return next(new errors.TooManyRequestsError({
                message: 'Too many attempts try again in ' + moment(nextValidRequestDate).fromNow(true),
                context: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.error',
                    {rfa: spamGlobalReset.freeRetries + 1 || 5, rfp: spamGlobalReset.lifetime || 60 * 60}),
                help: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.context')
            }));
        },
        handleStoreError: handleStoreError
    }, _.pick(spamGlobalBlock, spamConfigKeys))
);

// Stops login attempts for a user+IP pair with an increasing time period starting from 10 minutes
// and rising to a week in a fibonnaci sequence
// The user+IP count is reset when on successful login
// Default value of 5 attempts per user+IP pair
userLogin = new ExpressBrute(store,
    _.extend({
        attachResetToRequest: true,
        failCallback: function (req, res, next, nextValidRequestDate) {
            return next(new errors.TooManyRequestsError({
                message: 'Too many attempts try again in ' + moment(nextValidRequestDate).fromNow(true),
                context: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.error',
                    {rfa: spamUserLogin.freeRetries + 1 || 5, rfp: spamUserLogin.lifetime || 60 * 60}),
                help: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.context')
            }));
        },
        handleStoreError: handleStoreError
    }, _.pick(spamUserLogin, spamConfigKeys))
);

// Stop password reset requests when there are (freeRetries + 1) requests per lifetime per email
// Defaults here are 5 attempts per hour for a user+IP pair
// The endpoint is then locked for an hour
userReset = new ExpressBrute(store,
    _.extend({
        attachResetToRequest: true,
        failCallback: function (req, res, next, nextValidRequestDate) {
            return next(new errors.TooManyRequestsError({
                message: 'Too many attempts try again in ' + moment(nextValidRequestDate).fromNow(true),
                context: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.error',
                    {rfa: spamUserReset.freeRetries + 1 || 5, rfp: spamUserReset.lifetime || 60 * 60}),
                help: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.context')
            }));
        },
        handleStoreError: handleStoreError
    }, _.pick(spamUserReset, spamConfigKeys))
);

// This protects a private blog from spam attacks. The defaults here allow 10 attempts per IP per hour
// The endpoint is then locked for an hour
privateBlog = new ExpressBrute(store,
    _.extend({
        attachResetToRequest: false,
        failCallback: function (req, res, next, nextValidRequestDate) {
            logging.error(new errors.GhostError({
                message: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.error',
                    {rfa: spamPrivateBlog.freeRetries + 1 || 5, rfp: spamPrivateBlog.lifetime || 60 * 60}),
                context: i18n.t('errors.middleware.spamprevention.forgottenPasswordIp.context')
            }));

            return next(new errors.GhostError({
                message: 'Too many attempts try again in ' + moment(nextValidRequestDate).fromNow(true)
            }));
        },
        handleStoreError: handleStoreError
    }, _.pick(spamPrivateBlog, spamConfigKeys))
);

module.exports = {
    globalBlock: globalBlock,
    globalReset: globalReset,
    userLogin: userLogin,
    userReset: userReset,
    privateBlog: privateBlog
};
