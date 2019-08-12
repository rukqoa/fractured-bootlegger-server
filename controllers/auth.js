const moment = require('moment');
const guid = require('uuid/v4');
const MongoClient = require('mongodb').MongoClient;
const passport = require('passport');
const DiscordStrategy = require('passport-discord').Strategy;

const config = require('../config.js');


module.exports = function (app) {
    let db, accounts;

    MongoClient.connect(config.mongoUrl, {useNewUrlParser: true}, function (error, client) {
        if (error) {
            console.log(error);
        } else {
            db = client.db(config.mongoDb);
            accounts = db.collection('accounts');
        }
    });

    let discordScopes = ['identify', 'email'];
    let discordStrategy = new DiscordStrategy({
        clientID: config.discordId,
        clientSecret: config.discordSecret,
        callbackURL: '/callback',
        scope: discordScopes
    }, function (accessToken, refreshToken, profile, cb) {
        accounts.findOneAndUpdate(
            {discordId: profile.id, username: profile.username},
            {$setOnInsert: {guid: guid(), username: profile.username}},
            {upsert: true, returnNewDocument: true},
            function (error, account) {
                return cb(error, account.value);
            });
    });
    passport.use(discordStrategy);

    passport.serializeUser(function (user, done) {
        done(null, user);
    });
    passport.deserializeUser(function (obj, done) {
        done(null, obj);
    });

    app.use(passport.initialize());
    app.use(passport.session());

    app.get('/', checkLogin, function (req, res) {
        res.redirect('/home')
    });

    app.get('/login', passport.authenticate('discord', {scope: discordScopes}), function (req, res) {
    });

    app.get('/callback',
        passport.authenticate('discord', {failureRedirect: '/'}), function (req, res) {
            res.redirect('/home')
        });

    app.get('/home', checkLogin, function (req, res) {
        res.render('home', {title: 'Fractured Bootlegger', user: req.user});
    });

    app.get('/logout', function (req, res) {
        req.logout();
        res.redirect('/');
    });

    function checkLogin(req, res, next) {
        if (req.isAuthenticated()) return next();
        res.redirect('/login')
    }
};