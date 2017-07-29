const passport = require('passport');
const crypto = require('crypto');
const mongoose = require('mongoose');
const User = mongoose.model('User');
const promisify = require('es6-promisify');
const mail = require('../handlers/mail')

exports.login = passport.authenticate('local', {
	failureRedirect: '/login',
	failureFlash: 'Failed Login',
	successRedirect: '/', 
	successFlash: 'You are now logged in!'
});

exports.logout = (req, res) => {
	req.logout();
	req.flash('success', 'You are now logged out!');
	res.redirect('/');
}

exports.isLoggedIn = (req, res, next) => {
	// first check if the user is authenticated
	if(req.isAuthenticated()) {
		next(); // carry on! They are logged in!
		return;
	}
	req.flash('error', 'Oops you must be logged in to do that!');
	res.redirect('/login');
}

exports.forgot = async (req, res) => {
	// see if that user eith that email exists
	const user = await User.findOne({email: req.body.email});
	if(!user) {
		req.flash('error', 'No account with that email exists.');
		return res.redirect('/login');
	}
	// reset tokens and expiry on their account
	user.resetPasswordToken = crypto.randomBytes(20).toString('hex');
	user.resetPasswordExpires = Date.now() + 3600000; // 1 hour from now
	await user.save();
	// send them an email with the token
	const resetURL = `http://${req.headers.host}/account/reset/${user.resetPasswordToken}`;
	await mail.send({
		user,
		filename: 'password-reset',
		subject: 'Password Reset',
		resetURL
	});
	req.flash('success', `You have been emailed a password reset link.`);
	// redirect to login page 
	res.redirect('/login'); 
};

exports.reset = async (req, res) => {
	const user = await User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: { $gt: Date.now() }
	});
	if(!user) {
		req.flash('error', 'Password reset is invalid or has expired');
		return res.redirect('/login');
	}
	// if thtere is a user, show the reset password form
	res.render('reset', { title: 'Reset Your Password' });
};

exports.confirmedPasswords = (req, res, next) => {
		if(req.body.password === req.body['password-confirm']) {
			next(); // keepit going!
			return;
		}
		req.flash('error', 'Passwords do not match!');
		res.redirect('back');
};

exports.update = async (req, res) => {
	const user = await User.findOne({
		resetPasswordToken: req.params.token,
		resetPasswordExpires: { $gt: Date.now()}
	});
	if(!user) {
		req.flash('error', 'Password reset is invalid or has expired');
		return res.redirect('/login');
	}

	const setPassword = promisify(user.setPassword, user); // setPassword(), from the mongoose plugin we used in our model, we are promisifying it because it returns a callback and not a promise
	await setPassword(req.body.password);
	user.resetPasswordToken = undefined;
	user.resetPasswordExpires = undefined;
	const updatedUser = await user.save();
	await req.login(updatedUser); //req.login a middleware on passportJS we used that allows the user to be logged in directly
	req.flash('success', "Nice! Your password has been reset! You are now logged in!");
	return res.redirect('/');
}