const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const slug = require('slugs');

const storeSchema = new mongoose.Schema({
	name: {
		type: String,
		trim: true,
		required: 'Please enter a store name!'
	},
	slug: String,
	description: {
		type: String,
		trim: true
	},
	tags: [String],
	created: {
		type: Date, 
		default: Date.now
	},
	location: {
		type: {
			type: String,
			default: 'Point'
		},
		coordinates: [{
			type: Number,
			required: "You must supply coordinates!"
		}],
		address: {
			type: String,
			required: "You must supply an address!"
		}
	},
	photo: String,
	author: {
		type: mongoose.Schema.ObjectId,
		ref: 'User',
		required: 'You must supply an author'
	}

}, {
	toJSON: { virtuals: true},
	toObject: { virtuals: true}
});

// Define our indexes
storeSchema.index({
	name: 'text',
	description: 'text'
});

storeSchema.index({ location: '2dsphere' });

storeSchema.pre('save', async function(next) {
	if(!this.isModified('name')) {
		next() // skip it
		return; // which will stop this function from running 
	}
	this.slug = slug(this.name);
	// find other stores that have a slug of wes, wes-1, wes-2
	const slugRegEx = new RegExp(`^(${this.slug})((-[0-9]*$)?)$`, 'i');
	const storesWithSlug = await this.constructor.find({ slug: slugRegEx });
	if(storesWithSlug.length) {
		this.slug = `${this.slug}-${storesWithSlug.length + 1}`;
	}
	next();
	// TODO make more resiliant so slugs are unique
})

// aggregate is like a query function, its like .find() except we 
// can do much more complex stuff inside of it
// returning aggregate is going to return a promise so that we can await 
// the results
storeSchema.statics.getTagsList = function() {
	return this.aggregate([
		{ $unwind: '$tags'},
		{ $group: { _id: '$tags', count: { $sum: 1} }},
		{ $sort: { count: -1 } }
		]);
	};

storeSchema.statics.getTopStores = function() {
	return this.aggregate([

		// lookup Stores and populate their reviews
		{ $lookup: {from: 'reviews', localField: '_id',
					foreignField: 'store', as: 'comments'}},
		// filter for only items that have 2 or more reviews
		{ $match: { 'comments.1': { $exists: true } }},
		// Add the average reviews filed
		 // { $addFields: { works for mongodb 3.4

			
			{ $project: { // this is for mongodb 3.2 $addFields was included in mongodb 3.4
			photo: '$$ROOT.photo',
			name: '$$ROOT.name',
			comments: '$$ROOT.comments',
			slug: '$$ROOT.slug',

			averageRating: { $avg: '$comments.rating' }
		}},
		// sort it by our new filed, highest reviews first
		{ $sort: { averageRating: -1}},
		// limit to at most 10
		{ $limit: 10}
		]);
}
// find reviews where the stores _id property === reviews store property
storeSchema.virtual('reviews', {
	ref: 'Review', // what model to link?
	localField: '_id', // which field on the store?
	foreignField: 'store' // which field on the review?
});

function autopopulate(next) {
	this.populate('reviews');
	next();
}
storeSchema.pre('find', autopopulate);
storeSchema.pre('findOne', autopopulate);


module.exports = mongoose.model('Store', storeSchema);