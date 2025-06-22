/**
 * Collection Controller
 * Refactored to use Sequelize consistently
 */
const multer = require('multer');
const Aws = require('aws-sdk');
require("dotenv/config");

// Import standardized database utilities
const db = require('../models');
const dbUtil = require('../util/database');

// Image upload configuration
const storage = multer.memoryStorage({
    destination: function (req, files, cb) {
        cb(null, '');
    }
});

const filefilter = (req, files, cb) => {
    if (files.mimetype === 'image/jpeg' || files.mimetype === 'image/jpg' || files.mimetype === 'image/png' || files.mimetype === 'image/gif') {
        cb(null, true);
    } else {
        cb(null, false);
    }
};

const uploadImg = multer({ storage: storage, fileFilter: filefilter }).fields([{
    name: 'profile_image', maxCount: 1
}, {
    name: 'banner_image', maxCount: 1
}, {
    name: 'featured_image', maxCount: 1
}]);

// AWS S3 configuration
const s3 = new Aws.S3({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

/**
 * Add new collection
 */
const addCollection = async (req, res) => {
    try {
        const { name, description, category_id, user_id, royalty, collection_url, collection_custom_url, blockchain, payment_tokens } = req.body;

        // Validate required fields
        if (!name || !category_id || !user_id) {
            return res.status(400).json({
                success: false,
                msg: "Missing required fields"
            });
        }

        // Check if category exists
        const category = await dbUtil.findById('categories', category_id);
        if (!category) {
            return res.status(404).json({
                success: false,
                msg: "Category not found"
            });
        }

        // Check if user exists
        const user = await dbUtil.findById('users', user_id);
        if (!user) {
            return res.status(404).json({
                success: false,
                msg: "User not found"
            });
        }

        // Check if collection with custom URL already exists
        if (collection_custom_url) {
            const existingCollection = await dbUtil.findOne('collections', {
                collection_custom_url
            });

            if (existingCollection) {
                return res.status(400).json({
                    success: false,
                    msg: "Collection URL already in use"
                });
            }
        }

        // Process image uploads
        let logoImage = null;
        let bannerImage = null;
        let featuredImage = null;

        if (req.files) {
            if (req.files.profile_image) {
                const logoFile = req.files.profile_image[0];
                const logoParams = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: `collections/logo/${Date.now()}-${logoFile.originalname}`,
                    Body: logoFile.buffer,
                    ContentType: logoFile.mimetype
                };

                const logoUpload = await s3.upload(logoParams).promise();
                logoImage = logoUpload.Location;
            }

            if (req.files.banner_image) {
                const bannerFile = req.files.banner_image[0];
                const bannerParams = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: `collections/banner/${Date.now()}-${bannerFile.originalname}`,
                    Body: bannerFile.buffer,
                    ContentType: bannerFile.mimetype
                };

                const bannerUpload = await s3.upload(bannerParams).promise();
                bannerImage = bannerUpload.Location;
            }

            if (req.files.featured_image) {
                const featuredFile = req.files.featured_image[0];
                const featuredParams = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: `collections/featured/${Date.now()}-${featuredFile.originalname}`,
                    Body: featuredFile.buffer,
                    ContentType: featuredFile.mimetype
                };

                const featuredUpload = await s3.upload(featuredParams).promise();
                featuredImage = featuredUpload.Location;
            }
        }

        // Create collection
        const newCollection = await dbUtil.create('collections', {
            name,
            description,
            logo_image: logoImage,
            banner_image: bannerImage,
            featured_image: featuredImage,
            category_id,
            user_id,
            royalty: royalty || 0,
            collection_url,
            collection_custom_url,
            blockchain,
            payment_tokens: payment_tokens ? JSON.stringify(payment_tokens) : null,
            status: true
        });

        return res.status(201).json({
            success: true,
            msg: "Collection created successfully",
            data: newCollection
        });
    } catch (error) {
        console.error('Error creating collection:', error);
        return res.status(500).json({
            success: false,
            msg: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get all collections
 */
const getAllCollections = async (req, res) => {
    try {
        const { page = 1, limit = 10, category_id, user_id, search } = req.query;
        const offset = (page - 1) * limit;

        // Build query conditions
        const where = { status: true };
        if (category_id) where.category_id = category_id;
        if (user_id) where.user_id = user_id;
        if (search) {
            where[dbUtil.Op.or] = [
                { name: { [dbUtil.Op.like]: `%${search}%` } },
                { description: { [dbUtil.Op.like]: `%${search}%` } }
            ];
        }

        // Get collections with pagination
        const collections = await dbUtil.query({
            model: 'collections',
            where,
            include: [
                {
                    model: db.categories,
                    as: 'category_details'
                },
                {
                    model: db.users,
                    as: 'creator_details'
                },
                {
                    model: db.items,
                    as: 'collection_items_count'
                }
            ],
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['createdAt', 'DESC']]
        });

        // Get total count
        const totalCollections = await dbUtil.count('collections', where);

        return res.status(200).json({
            success: true,
            data: collections,
            pagination: {
                total: totalCollections,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(totalCollections / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching collections:', error);
        return res.status(500).json({
            success: false,
            msg: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Get collection by ID
 */
const getCollectionById = async (req, res) => {
    try {
        const { id } = req.params;

        // Get collection with related data
        const collection = await dbUtil.findById('collections', id, [
            {
                model: db.categories,
                as: 'category_details'
            },
            {
                model: db.users,
                as: 'creator_details'
            },
            {
                model: db.items,
                as: 'collection_items_count'
            }
        ]);

        if (!collection) {
            return res.status(404).json({
                success: false,
                msg: "Collection not found"
            });
        }

        return res.status(200).json({
            success: true,
            data: collection
        });
    } catch (error) {
        console.error('Error fetching collection:', error);
        return res.status(500).json({
            success: false,
            msg: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Update collection
 */
const updateCollection = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, description, category_id, royalty, collection_url, collection_custom_url, blockchain, payment_tokens, status } = req.body;

        // Check if collection exists
        const collection = await dbUtil.findById('collections', id);
        if (!collection) {
            return res.status(404).json({
                success: false,
                msg: "Collection not found"
            });
        }

        // Check if custom URL is already in use by another collection
        if (collection_custom_url && collection_custom_url !== collection.collection_custom_url) {
            const existingCollection = await dbUtil.findOne('collections', {
                collection_custom_url,
                id: { [dbUtil.Op.ne]: id }
            });

            if (existingCollection) {
                return res.status(400).json({
                    success: false,
                    msg: "Collection URL already in use"
                });
            }
        }

        // Process image uploads
        let updateData = {
            name: name || collection.name,
            description: description || collection.description,
            category_id: category_id || collection.category_id,
            royalty: royalty !== undefined ? royalty : collection.royalty,
            collection_url: collection_url || collection.collection_url,
            collection_custom_url: collection_custom_url || collection.collection_custom_url,
            blockchain: blockchain || collection.blockchain,
            payment_tokens: payment_tokens ? JSON.stringify(payment_tokens) : collection.payment_tokens,
            status: status !== undefined ? status : collection.status
        };

        if (req.files) {
            if (req.files.profile_image) {
                const logoFile = req.files.profile_image[0];
                const logoParams = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: `collections/logo/${Date.now()}-${logoFile.originalname}`,
                    Body: logoFile.buffer,
                    ContentType: logoFile.mimetype
                };

                const logoUpload = await s3.upload(logoParams).promise();
                updateData.logo_image = logoUpload.Location;
            }

            if (req.files.banner_image) {
                const bannerFile = req.files.banner_image[0];
                const bannerParams = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: `collections/banner/${Date.now()}-${bannerFile.originalname}`,
                    Body: bannerFile.buffer,
                    ContentType: bannerFile.mimetype
                };

                const bannerUpload = await s3.upload(bannerParams).promise();
                updateData.banner_image = bannerUpload.Location;
            }

            if (req.files.featured_image) {
                const featuredFile = req.files.featured_image[0];
                const featuredParams = {
                    Bucket: process.env.AWS_BUCKET_NAME,
                    Key: `collections/featured/${Date.now()}-${featuredFile.originalname}`,
                    Body: featuredFile.buffer,
                    ContentType: featuredFile.mimetype
                };

                const featuredUpload = await s3.upload(featuredParams).promise();
                updateData.featured_image = featuredUpload.Location;
            }
        }

        // Update collection
        await dbUtil.update('collections', updateData, { id });

        return res.status(200).json({
            success: true,
            msg: "Collection updated successfully"
        });
    } catch (error) {
        console.error('Error updating collection:', error);
        return res.status(500).json({
            success: false,
            msg: "Internal server error",
            error: error.message
        });
    }
};

/**
 * Delete collection
 */
const deleteCollection = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if collection exists
        const collection = await dbUtil.findById('collections', id);
        if (!collection) {
            return res.status(404).json({
                success: false,
                msg: "Collection not found"
            });
        }

        // Check if collection has items
        const itemCount = await dbUtil.count('items', { collection_id: id });
        if (itemCount > 0) {
            return res.status(400).json({
                success: false,
                msg: "Cannot delete collection with items"
            });
        }

        // Delete collection
        await dbUtil.destroy('collections', { id });

        return res.status(200).json({
            success: true,
            msg: "Collection deleted successfully"
        });
    } catch (error) {
        console.error('Error deleting collection:', error);
        return res.status(500).json({
            success: false,
            msg: "Internal server error",
            error: error.message
        });
    }
};

// Export controller methods
module.exports = {
    uploadImg,
    addCollection,
    getAllCollections,
    getCollectionById,
    updateCollection,
    deleteCollection
};
