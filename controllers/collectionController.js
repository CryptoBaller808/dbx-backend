const { DATE } = require('sequelize')
const db = require('../util/database.js')
const multer = require('multer')              // multer will be used to handle the form data.
const Aws = require('aws-sdk')                // aws-sdk library will used to upload image to s3 bucket.
// const pool = require('data/config.js')                // aws-sdk library will used to upload image to s3 bucket.
require("dotenv/config")  
// create main Model
const Category = db.categories
const Collections = db.collections
const Items = db.items
const ItemProperties = db.item_properties
const Wishlist = db.wishlist
const User = db.users
const ItemActivity = db.item_activity
const ItemSaleInfo = db.item_sale_info

const Setting= db.setting
var Sequelize = require('sequelize');
const Op = Sequelize.Op;

//#region Image Upload 
// creating the storage variable to upload the file and providing the destination folder, 
// if nothing is provided in the callback it will get uploaded in main directory

const storage = multer.memoryStorage({
    destination: function (req, files, cb) {
        if(files === null){
            console.log("image field is null");
        }
        console.log("image field is not null");
        cb(null, '')
    }
})


// below variable is define to check the type of file which is uploaded

const filefilter = (req, files, cb) => {
    if (files.mimetype === 'image/jpeg' || files.mimetype === 'image/jpg' || files.mimetype === 'image/png' || files.mimetype === 'image/gif') {
        cb(null, true)
        //console.log("Image" , file);
    } else {
        cb(null, false)
    }
}

// defining the upload variable for the configuration of photo being uploaded
const uploadImg = multer({ storage: storage, fileFilter: filefilter }).fields([{
    name: 'profile_image', maxCount: 1
  }, {
    name: 'cover_image', maxCount: 1
  }]);

//const uploadImg2 = multer({ storage: storage, fileFilter: filefilter }).single('cover_image');


// Now creating the S3 instance which will be used in uploading photo to s3 bucket.
const s3 = new Aws.S3({
    accessKeyId:process.env.AWS_ACCESS_KEY_ID,              // accessKeyId that is stored in .env file
    secretAccessKey:process.env.AWS_ACCESS_KEY_SECRET       // secretAccessKey is also store in .env file
})



//#endregion
// main work

//  9. Create collection
const createCollection = async (req, res) => {
        var catt = req.body.category_id
        if(catt > 7)res.status(400).send("Please select cat id from 0-7 only.");
       // get current time through javaScript
       var today = new Date();
       var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
       var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
       var dateTime = date+' '+time;
       var update1 = dateTime;
//Image upload to s3 

console.log("All Files" , req.files);
//return false;
let profileres =''; 
let coverres ='';
let imageexists = null ;    
let imageexists2 = null ;   
//for profile image 
if(req.files.profile_image === undefined){
    console.log("here i am");
    imageexists = false;
}else{
    const params = {
        Bucket:process.env.AWS_BUCKET_NAME + "/collection-assets",      // bucket that we made earlier
        Key:req.files.profile_image[0].originalname,               // Name of the image
        Body:req.files.profile_image[0].buffer,                    // Body which will contain the image in buffer format
        ACL:"public-read-write",                 // defining the permissions to get the public link
        ContentType:req.files.profile_image[0].mimetype               // Necessary to define the image content-type to view the photo in the browser with the link
    };
    const upload = await s3.upload(params).promise().then(data =>{
        // if(error){
        //     res.status(500).send({"err":error})  // if we get any error while uploading error message will be returned.
        // }
        // this will give the information about the object in which photo is stored 
        profileres = data.Location;
        console.log("data2" ,data.Location);
        console.log("data2" ,profileres);
        imageexists = true;
        return profileres;
    }) //return false;
    
    
}


//for cover image 
if(req.files.cover_image === undefined){
    imageexists2 = false;
}else{
    console.log(req.files.cover_image[0].originalname);
    const params2 = {
        Bucket:process.env.AWS_BUCKET_NAME + "/collection-assets",      // bucket that we made earlier
        Key:req.files.cover_image[0].originalname,               // Name of the image
        Body:req.files.cover_image[0].buffer,                    // Body which will contain the image in buffer format
        ACL:"public-read-write",                 // defining the permissions to get the public link
        ContentType:req.files.cover_image[0].mimetype                // Necessary to define the image content-type to view the photo in the browser with the link
    };
    //cover response 
const upload2 = await s3.upload(params2).promise().then(data2 =>{
    // this will give the information about the object in which photo is stored 
    coverres = data2.Location;
    console.log("data2" ,data2);
    imageexists2 = true;
})

    
}



// console.log("cover image response" , params);
// console.log("profile image response" , params2);
console.log("cover image response" , coverres);
console.log("profile image response" , profileres);
let info ={};
const {twitter_url,insta_url,discord_url,fb_url, collection_custom_url, royalty} = req.body;
const {profile_image,cover_image} = req.files;
info.category_id = req.body.category_id;
info.name = req.body.name;
info.user_id = req.body.user_id;
info.updated_at = update1;
if(twitter_url) info.twitter_url = req.body.twitter_url;
if(collection_custom_url) info.collection_custom_url = req.body.collection_custom_url;
if(royalty) info.royalty = req.body.royalty;
if(insta_url) info.insta_url = req.body.insta_url;
if(discord_url) info.discord_url = req.body.discord_url;
if(cover_image) info.cover_image =coverres;
if(fb_url) info.fb_url = req.body.fb_url;
if(profile_image) info.profile_image = profileres;
console.log("this is test : " + info);

    // Check if the collection_custom_url is already taken


    const existingCollection = await Collections.findOne({
      where: { collection_custom_url: collection_custom_url },
    });
    
    if (existingCollection) {
      return res.status(400).send("Custom URL is already taken.");
    }

    // const collections = 
    Collections.create(info).then(function(vari){
        var obj = JSON.stringify(vari);
            obj = JSON.parse(obj);
            delete obj.is_deleted;
            delete obj.updated_at;
            delete obj.created_at;
            delete obj.smartcontract_address;
            res.status(201).send(obj);
        // res.status(201).send(vari);
    }).catch(function(err){
        console.log(err);
        res.status(400).send("Please make sure user id and category id is correct.")
    });

}



const updateCollection = async (req, res) => {

    let profileres =''; 
    let coverres ='';
    let imageexists = null ;    
    let imageexists2 = null ;  
    //for profile image
    if(req.files.profile_image === undefined){
        imageexists = false;
    }else{
        const params = {
            Bucket:process.env.AWS_BUCKET_NAME + "/collection-assets",      // bucket that we made earlier
            Key:req.files.profile_image[0].originalname,               // Name of the image
            Body:req.files.profile_image[0].buffer,                    // Body which will contain the image in buffer format
            ACL:"public-read-write",                 // defining the permissions to get the public link
            ContentType:req.files.profile_image[0].mimetype               // Necessary to define the image content-type to view the photo in the browser with the link
        };
        const upload = await s3.upload(params).promise().then(data =>{
            // if(error){
            //     res.status(500).send({"err":error})  // if we get any error while uploading error message will be returned.
            // }
            // this will give the information about the object in which photo is stored 
            profileres = data.Location;
            console.log("data2" ,data.Location);
            console.log("data2" ,profileres);
            imageexists = true;
            return profileres;
        }) //return false;
        
        
    }
//for cover image 
if(req.files.cover_image === undefined){
    imageexists2 = false;
}else{
    console.log(req.files.cover_image[0].originalname);
    const params2 = {
        Bucket:process.env.AWS_BUCKET_NAME + "/collection-assets",      // bucket that we made earlier
        Key:req.files.cover_image[0].originalname,               // Name of the image
        Body:req.files.cover_image[0].buffer,                    // Body which will contain the image in buffer format
        ACL:"public-read-write",                 // defining the permissions to get the public link
        ContentType:req.files.cover_image[0].mimetype                // Necessary to define the image content-type to view the photo in the browser with the link
    };
    //cover response 
const upload2 = await s3.upload(params2).promise().then(data2 =>{
    // this will give the information about the object in which photo is stored 
    coverres = data2.Location;
    console.log("data2" ,data2);
    imageexists2 = true;
})

    
}

// console.log("cover image response" , params);
// console.log("profile image response" , params2);

   
   let id = req.body.collection_id;
   var something =  await Collections.findByPk(id);
   if(something){
   // get current time through javaScript
   var today = new Date();
   var date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
   var time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
   var dateTime = date+' '+time;
   var update1 = dateTime;
   
   console.log("this date : " + update1);
   const info ={};
   const {options} = {multi: true};
   const {twitter_url,insta_url,discord_url,fb_url, collection_custom_url} = req.body;
   const {profile_image,cover_image} = req.files;
   const objid = { 'id': id};
//    info.name = req.body.name;
//    info.user_id = req.body.user_id;
   info.updated_at = update1;
   if(twitter_url) info.twitter_url = req.body.twitter_url;
   if(insta_url) info.insta_url = req.body.insta_url;
   if(discord_url) info.discord_url = req.body.discord_url;
   if(collection_custom_url) info.collection_custom_url = req.body.collection_custom_url;
   if(cover_image) info.cover_image =cover_image;
   if(fb_url) info.fb_url = req.body.fb_url;
   if(profile_image) info.profile_image = profileres;
   console.log("this is test : " + info);
   const updateCollection =  await Collections.update(info,{where: objid},options);
    if (!updateCollection){
        console.log("this is updateCollection Error ::::" + updateUserProfile);
        res.status(400).send({
                status:'error',
                message:'Collectionnot with id '+ collection_id +' failed update'
        });
    }else{
    res.status(200).send({
        status:'success',
        message: "collection updated"
    });
}}else{
    res.status(400).send("Collection not found.");
}
}

//  10. get collections

const getCollections = async (req, res) => {
    Collections.findAll({
        include: [{
            model: Category,
            as : "category_details",
            required: false,}]}
    ).then(category_name =>{
        var obj = JSON.stringify(category_name);
            obj = JSON.parse(obj);
            for(i=0;i<obj.length;i++){
                delete obj[i].is_deleted;
                delete obj[i].updated_at;
                delete obj[i].created_at;
                delete obj[i].smartcontract_address;
            }
            res.status(200).send(obj);
        //??please add wallet address in response
    }).catch(err=>{
        console.log("err : " + err);
        res.status(500).send("There was an error in fetching data.")
    });

}

//  11. get collection by collection ID


const getCollectionbyId = async (req, res) => {
  console.log("haha");
    let id = req.query.id;
    let custom_url = req.query.custom_url;
    console.log(req);
   
    const whereCondition = {};
   console.log(id);

   console.log(custom_url);

      if (id !== undefined) {
        whereCondition.Id = id;
      }
    

      if (custom_url !== undefined) {
        whereCondition.collection_custom_url = custom_url;
      }
      
    
      if (Object.keys(whereCondition).length === 0) {
        return res.status(400).send("Please provide either id or name.");
      }
    


        var collectiondata4 = await Collections.findOne({
          where: whereCondition,
            attributes:{exclude: ['is_deleted','smartcontract_address','user_id','created_at','updated_at',]},
            include :[
                {
                    model: User,
                    as : "creator_details",
                    required: true,
                    attributes: {exclude: ['access_token','xumm_token','is_deleted','created_at','updated_at']},
                },
                {
                    model: Items,
                    as : "collection_items_count",
                    required: false,
                    attributes: {exclude: ['access_token','xumm_token','is_deleted','created_at','updated_at']},
                },
            ]
            }
        ).then(coldata =>{
          console.log("COLData:::",coldata);
          return coldata;}).catch(err => {console.log(err); return;});
        if(collectiondata4 == null)return res.status(400).send("Collection doesn't exists.");
        const bobj = JSON.stringify(collectiondata4);
        var collectiondata = JSON.parse(bobj);
        collection_id = collectiondata.id;
        var total_items = 0;
        console.log("collection data :::::",collectiondata);
        if(collectiondata.collection_items_count) total_items = collectiondata.collection_items_count.length;
        delete collectiondata.is_deleted;
        delete collectiondata.collection_items_count;
        var newdata = {total_items : total_items ,owners : 10, floor_price : 7 , volume_traded : 7};
        collectiondata = Object.assign(collectiondata,newdata)
        // var collectiondata = {extra_details,collectiondata4}
        // console.log("this is collection" ,collectiondata);
        Items.findAndCountAll({
            distinct:true,
            subQuery:false,
            attributes: {exclude: ['sale_index','collection_id','item_status','token_id','sc_address','meta_uri','is_deleted','created_at','updated_at']},
            where :{
                collection_id:collection_id,
              },
             
              include: [
                {
                  model: Collections,
                  as :"item_collection",
                  required: false,
                  attributes: {exclude: ['created_at','updated_at','is_deleted','smartcontract_address','user_id']},
                  include: [
                    {
                      model: Category,
                      as :"category_details",
                      required: false
                    }
                  ]
          },
          {
            model: ItemProperties,
            as : "item_properties_details",
            required: false,
          },
          { //not working..  might be a issue with sequelize   https://lightrun.com/answers/sequelize-sequelize-no-multiple-includes-possible-when-using-count-function
            // below counted over a loop after result.
            model: Wishlist,
            as : "wishlist_count",
            attributes: {exclude: ['id','item_id']},
            required: false,
           
          },
          {
            model: User,
            as : "current_owner_details",
            required: false,
            attributes: {exclude: ['access_token','xumm_token','is_deleted','created_at','updated_at']},
          },
          {
            model: User,
            as : "creator",
            required: false,
            attributes: {exclude: ['access_token','xumm_token','is_deleted','created_at','updated_at']},
          },
        ],
      }).then(res2=>{
            const aobj = JSON.stringify(res2);
            const obj = JSON.parse(aobj);
            console.log("this is test too:::",obj);
            for(i=0;i<obj.rows.length;i++){
                var tempobj = {"count":"", "rows":[]};
                tempobj.count = obj.rows[i].wishlist_count.length;
                console.log("this is test::::::::::",tempobj,i);
                tempobj.rows = obj.rows[i].wishlist_count;
                obj.rows[i].wishlist_count = Object.assign(tempobj);
            }

                // console.log("obj is :" , obj);     
            var obj3 = {"collection" : collectiondata , "item_list": ""};
            for(i=0;i<obj.rows.length;i++){
              obj.rows[i] = {"item_detail": obj.rows[i]}
            }
              // pagination
// offset: parseInt(page_number),
// limit: parseInt(page_size),
console.log("hiiiii");
// console.log(req.query.page_number , req);
if(req.query.page_number || req.query.page_size){
    var skip =  (req.query.page_number * req.query.page_size) -  req.query.page_size;
    var xx = skip;
    var objpage=[];  
    var newobkindex = 0;   
    console.log(obj.count, skip);
    if(obj.count <= skip ){
      //skip
      obj.rows = [];
    }else{
      console.log(skip,(parseInt(xx)+parseInt(req.query.page_size)));
    for(skip;skip<(parseInt(xx)+parseInt(req.query.page_size));skip++){
      // console.log(objpage);
      if(obj.rows[skip])objpage[newobkindex] =  obj.rows[skip];
      newobkindex++;
      // console.log(skip,xx,newobkindex);
    }
    obj.rows = objpage;
  }
  }
            obj3.item_list = obj;
            res.status(201).send(obj3);
        }).catch(err =>{
            console.log(err);
            res.status(400).send("Error in execution");
        });
    }
   

//     // else{
//     //     res.status(404).send("There is no record with this ID");      
//     // }
// }

//  11. get nft by category ID


const getItemsByCategories = async (req, res) => {
    let id = req.query.id;
    if(id == ''||id == null)res.status(400).send("Please enter Id");
    var page_number = 0;
    var page_size = 100000; 
    if(req.query.page_size > 0 && req.query.page_size  != {page_size}) page_size = req.query.page_size;
    if(req.query.page_number > 0 &&  req.query.page_number != {page_number}) page_number = ((req.query.page_number - 1) * page_size);
    console.log("details",id,page_number,page_size);
    if(id){
        
        Items.findAndCountAll({
            // offset: parseInt(page_number),
            // limit: parseInt(page_size),
            attributes: {exclude: ['sale_index','collection_id','item_status','token_id','sc_address','meta_uri','is_deleted','created_at','updated_at']},
            distinct:true,
            subQuery: false,
            include: [
            {
            model: Collections,
            as :"item_collection",
            required: true,
            attributes: {exclude: ['is_deleted','created_at','updated_at', 'smartcontract_address']},
            where :{
                category_id:id,
              },
            include: [
              {
                model: Category,
                as :"category_details",
                required: false,

              }
            ]
          },
          {
            model: ItemProperties,
            as : "item_properties_details",
            required: false,
          },
          { //not working..  might be a issue with sequelize   https://lightrun.com/answers/sequelize-sequelize-no-multiple-includes-possible-when-using-count-function
            // below counted over a loop after result.
            model: Wishlist,
            as : "wishlist_count",
            attributes: {exclude: ['id','item_count']},
            required: false,
           
          },
          {
            model: User,
            as : "current_owner_details",
            required: false,
            attributes: {exclude: ['access_token','xumm_token','is_deleted','created_at','updated_at']},
          },
          {
            model: User,
            as : "creator",
            required: false,
            attributes: {exclude: ['access_token','xumm_token','is_deleted','created_at','updated_at']},
          },
        ],
      }).then(res2=>{
            const aobj = JSON.stringify(res2);
            const obj = JSON.parse(aobj);
            for(i=0;i<obj.rows.length;i++){
                // obj.rows[i].wishlist_count = obj.rows[i].wishlist_count.length;
                var tempobj = {"count":"", "rows":[]};
                tempobj.count = obj.rows[i].wishlist_count.length;
                tempobj.rows = obj.rows[i].wishlist_count;
                obj.rows[i].wishlist_count = Object.assign(tempobj);
                var newobj = obj.rows[i];
                obj.rows[i] = {};
                obj.rows[i].item_detail = newobj;
            }
              // pagination
// offset: parseInt(page_number),
// limit: parseInt(page_size),
if(req.query.page_number || req.query.page_size){
    var skip =  (req.query.page_number * req.query.page_size) -  req.query.page_size;
    var xx = skip;
    var objpage=[];  
    var newobkindex = 0;   
    console.log(obj.count, skip);
    if(obj.count <= skip ){
      //skip
      obj.rows = [];
    }else{
      console.log(skip,(parseInt(xx)+parseInt(req.query.page_size)));
    for(skip;skip<(parseInt(xx)+parseInt(req.query.page_size));skip++){
      // console.log(objpage);
      if(obj.rows[skip])objpage[newobkindex] =  obj.rows[skip];
      newobkindex++;
      // console.log(skip,xx,newobkindex);
    }
    obj.rows = objpage;
  }
  }
                // console.log("obj is :" , obj);     
            // var obj3 = {"collection" : collectiondata , "item_list": ""};
            // obj3.item_list = obj;
            res.status(201).send(obj);
        }).catch(err =>{
            console.log(err);
            res.status(400).send("Error in execution");
        });
    }
    else{
        res.status(404).send("There is no record with this ID");      
    }

}
//  12. get collection by user ID
//  12. get collection by user ID


const getCollectionbyUserId = async (req, res) => {
    let id = req.params.id
    console.log(id);
    if(id){
    Collections.findAll({where: {user_id: id,},
        distinct:true,
      }).then(category_name =>{
        if(category_name == ""){
            res.status(404).send("There is no record with this ID");        
        }
        else{
            console.log(category_name);
            var obj = JSON.stringify(category_name);
            obj = JSON.parse(obj);
            for(i=0;i<obj.length;i++){
                delete obj[i].is_deleted;
                delete obj[i].updated_at;
                delete obj[i].created_at;
                delete obj[i].smartcontract_address;
            }
            res.status(201).send(obj);
        }
    }).catch(err=>{
        console.log("err : " + err);
        res.status(500).send("There was an error in fetching data.")
    });
}else{
    res.status(404).send("Please provide correct user ID.")
}

}
// not in use
const getAllItemsByCollectionId = async (req, res) => {
  let id = req.query.id;
  if(id == '' || id == null)res.status(400).send("Please enter userid.");
  var page_number = 0;
  var page_size = 10000; 
  if(req.query.page_size > 0) page_size = req.query.page_size;
  if(req.query.page_number > 0) page_number = ((req.query.page_number - 1) * page_size);
  console.log((req.query.page_number - 1) * page_size);
  console.log("pages:",page_number, page_size);
  if(id){
        Items.findAndCountAll({
         
          attributes: {exclude: ['is_deleted','updated_at','created_at','smartcontract_address','sale_index','token_id','sc_address','meta_uri']},
          include: [{
            model: Collections,
            as :"item_collection",
            where : {
              Id: id
            },
            required: true,
            attributes: {exclude: ['is_deleted','updated_at','created_at','smartcontract_address','user_id']},
            include: [
              {
                model: Category,
                as :"category_details",
                required: false
              }
            ]
          },
          {
            model: ItemSaleInfo,
            as :"item_sale_info",
            required: false,
            where:{ is_completed:0,
              [Op.or]: [
                { sale_type: 1},
                  {[Op.and]:[
                    {sale_type:2},
                    Sequelize.where(Sequelize.col('auction_end_date'), '>', Sequelize.fn('utc_timestamp'))
                  ]},
                 { sale_type: 3 },
              ]},
            attributes: {exclude: ['is_deleted','updated_at','sale_offer','is_completed','status_id']},
            // include: [
            //   {
            //     model: ItemSaleInfo,
            //     as :"item_sale_info",
            //     required: false
            //   }
            // ]
          },

          {
            model: ItemProperties,
            as : "item_properties_details",
            required: false,
            attributes: {exclude: ['item_id']},
          },
          { //not working..  might be a issue with sequelize   https://lightrun.com/answers/sequelize-sequelize-no-multiple-includes-possible-when-using-count-function
            // below counted over a loop after result.
            model: Wishlist,
            as : "wishlist_count",
            attributes: {exclude: ['id','item_id']},
            required: false,
           
          },
          {
            model: User,
            as : "creator",
            required: true,
            attributes: {exclude: ['is_deleted','created_at','updated_at','access_token','xumm_token']},
          },
          {
            model: User,
            as : "current_owner_details",
            required: false,
            attributes: {exclude: ['is_deleted','created_at','updated_at','access_token','xumm_token']},
          },
        ],
      }).then( async user =>{
          if(user){
      const aobj = JSON.stringify(user);
      var obj = JSON.parse(aobj);
      var tempobj = {"count":"", "rows":[]};
      tempobj.count = obj.rows.length;
      tempobj.rows = obj.rows;
      var objs = Object.assign(tempobj);
      for(i=0;i<obj.rows.length;i++){
        objs.rows[i] = {"item_detail": objs.rows[i]}
      }
      //pagination
      if(req.query.page_number || req.query.page_size){
        var skip =  (req.query.page_number * req.query.page_size) -  req.query.page_size;
        var xx = skip;
        var objpage=[];  
        var newobkindex = 0;   
        console.log(obj.count, skip);
        if(objs.count <= skip ){
          //skip
          objs.rows = [];
        }else{
          console.log(skip,(parseInt(xx)+parseInt(req.query.page_size)));
        for(skip;skip<(parseInt(xx)+parseInt(req.query.page_size));skip++){
          // console.log(objpage);
          if(objs.rows[skip])objpage[newobkindex] =  objs.rows[skip];
          newobkindex++;
          // console.log(skip,xx,newobkindex);
        }
        objs.rows = objpage;
      }
    }
      res.status(201).send(objs);
      return;
     await get_info(id, function(result){
        // console.log("this is redata2::",result);
         stuff_i_want = result;
         console.log("this is redata1::",stuff_i_want);
         if(stuff_i_want == ""){
           //do nothing 
           // return;
         }else{
           console.log("this is obj parsing");
           var obj2 = stuff_i_want;
           var keys = Object.keys(obj2);
          //  console.log("key" , obj2[keys[0]]);
           for(var i = 0; i< stuff_i_want.length; i++){
            //  console.log("value", obj2[keys[i]].value);
             var obj3 = obj2[keys[i]]
             obj = Object.assign(obj,obj3)
              // = obj2[keys[i]].value;
           } 
         }
         // obj
         res.status(201).send(obj);
             
         //rest of your code goes in here
        });

     }
          else{
              res.status(404).send("There is no record with this ID");
              
          }
      }).catch(err=>{
          console.log("err : " + err);
          res.status(500).send("There was an error in fetching data. Please contact admin.")
      });

      


  }else{
      res.status(404).send("Please provide correct ID.")
  }
  
  }



const getActivityByCollectionId = async (req, res) => {
    var id = req.query.id;
    if(id == '' || id == null)res.status(400).send("Please enter userid.");
    var page_number = 0;
    var page_size = 10000; 
    if(req.query.page_size > 0) page_size = req.query.page_size;
    if(req.query.page_number > 0) page_number = ((req.query.page_number - 1) * page_size);
    console.log((req.query.page_number - 1) * page_size);
    console.log("pages:",page_number, page_size);
    if(id){
      ItemActivity.findAndCountAll({
        // offset: parseInt(page_number),
        // limit: parseInt(page_size),
        distinct:true,
        subQuery:false,
        required:true,
        order: [['entry_date', 'desc']],
        attributes: {exclude: ['buyer','seller']},
        include: [ {
          model: Items,
          as :"item_detail",
          attributes: {exclude: ['item_status','token_id','sc_address','sale_index','is_deleted','created_at','updated_at','access_token','xumm_token']},
          required: true,
          include:[{
            model: Collections,
            as:"item_collection",
            attributes: {exclude: ['item_status','token_id','sc_address','smartcontract_address','is_deleted','created_at','updated_at']},
            required:true,
            where:{
              id:id,
              },
          }]
        },
          {
            model: User,
            as :"buyer_details",
            required: false,
            attributes: {exclude: ['is_deleted','created_at','updated_at','access_token','xumm_token']},
          },
          {
            model: User,
            as :"seller_details",
            // where:{seller:id},
            required: false,
            attributes: {exclude: ['is_deleted','created_at','updated_at','access_token','xumm_token']},
          }
        
      ],
    }).then(res2=>{
          const aobj = JSON.stringify(res2);
          const obj = JSON.parse(aobj);
          for(i=0;i<obj.rows.length;i++){
  
              // obj.rows[i].type = ActivityEnum[obj.rows[i].type];
              if(obj.rows[i].entry_date)obj.rows[i].entry_date = new Date(obj.rows[i].entry_date).toISOString().replace(/T/, ' ').replace(/\..+/, ' UTC');
              // if(obj.rows[i].entry_date)obj.rows[i].entry_date = new Date(obj.rows[i].entry_date).toISOString().replace(/T/, ' ').replace(/\..+/, ' UTC');
          }
              console.log("obj is :" , obj);    
                 // pagination
  // offset: parseInt(page_number),
  // limit: parseInt(page_size),
  if(req.query.page_number || req.query.page_size){
    var skip =  (req.query.page_number * req.query.page_size) -  req.query.page_size;
    var xx = skip;
    var objpage=[];  
    var newobkindex = 0;   
    console.log(obj.count, skip);
    if(obj.count <= skip ){
      //skip
      obj.rows = [];
    }else{
      console.log(skip,(parseInt(xx)+parseInt(req.query.page_size)));
    for(skip;skip<(parseInt(xx)+parseInt(req.query.page_size));skip++){
      // console.log(objpage);
      if(obj.rows[skip])objpage[newobkindex] =  obj.rows[skip];
      newobkindex++;
      // console.log(skip,xx,newobkindex);
    }
    obj.rows = objpage;
  }
  }     
          res.status(201).send(obj);
      }).catch(err =>{
          console.log(err);
          res.status(400).send("Error in execution");
      });
  }
  else{
      res.status(404).send("There is no record with this ID");      
  }
  }



  // get Platform Commission 

  const platformfee = async (req, res) => {
    Setting.findOne()
      .then((setting) => {
        if (!setting) {
          res.status(404).send("No record found");
        } else {
          const { value } = setting;
          const response = {
            platform_fee: value
          };
          res.status(200).json(response);
        }
      })
      .catch((err) => {
        console.log("Error: " + err);
        res.status(500).send("Error in fetching data");
      });
  };
  
  

// collection custom_url check 

checkCollectionCustomUrl = async (req, res) => {
  try {
    const customUrl = req.params.customUrl;
    if (!customUrl) {
      // Custom URL parameter is missing
      return res.status(400).json({ error: 'Custom URL parameter is missing' });
    }

    const existingCollection = await Collections.findOne({
      where: { collection_custom_url: customUrl },
    });

    if (existingCollection) {
      // Custom URL is already taken
      res.json({ available: false });
    } else {
      // Custom URL is available
      res.json({ available: true });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'An error occurred' });
  }
};

//   if(id){
//   Collections.findAll({where: {user_id: id,},
//       distinct:true,
//     }).then(category_name =>{
//       if(category_name == ""){
//           res.status(404).send("There is no record with this ID");        
//       }
//       else{
//           console.log(category_name);
//           var obj = JSON.stringify(category_name);
//           obj = JSON.parse(obj);
//           for(i=0;i<obj.length;i++){
//               delete obj[i].is_deleted;
//               delete obj[i].updated_at;
//               delete obj[i].created_at;
//               delete obj[i].smartcontract_address;
//           }
//           res.status(201).send(obj);
//       }
//   }).catch(err=>{
//       console.log("err : " + err);
//       res.status(500).send("There was an error in fetching data.")
//   });
// }else{
//   res.status(404).send("Please provide correct user ID.")
// }

// }


module.exports = {

    createCollection,
    getCollectionbyId,
    platformfee,
    getCollections,
    uploadImg, 
    updateCollection,
    getItemsByCategories,
    getCollectionbyUserId,
    getAllItemsByCollectionId,
    getActivityByCollectionId,
    checkCollectionCustomUrl
    // uploadImg2

}