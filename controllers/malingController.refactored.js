/**
 * Mailing Controller
 * Refactored to use Sequelize consistently
 */
const transporter = require("../util/utils");
const db = require("../models");
const dbUtil = require("../util/database");

/**
 * Handle contact us email submission
 * @route POST /api/contactUsEmail
 */
module.exports.contactUsEmail = async (req, res) => {
  const { email, userName, mailSubject, mailDescription } = req.body;
  
  try {
    if (!email || !userName) {
      return res.status(400).json({ 
        success: false,
        msg: "Email and name are required" 
      });
    }
    
    // Log contact request in database
    await dbUtil.create('contact_requests', {
      email,
      name: userName,
      subject: mailSubject,
      message: mailDescription,
      status: 'pending'
    });
    
    const mailOptions = {
      from: `${userName}- ${email}`,
      to: "digitalblockexchange@gmail.com",
      replyTo: email,
      subject: mailSubject,
      html: `
        <div>
          <h3>Hi I'm ${userName}</h3>
          <p>${mailDescription}</p>
        </div>
      `,
    };
    
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("Error sending contact email:", error);
        
        // Update status in database
        dbUtil.update('contact_requests', 
          { status: 'failed', error_message: error.message },
          { email, name: userName, status: 'pending' }
        );
        
        return res.status(500).json({
          success: false,
          msg: "Failed to send email",
          error: error.message,
        });
      } else {
        console.log("Email sent: " + info.response);
        
        // Update status in database
        dbUtil.update('contact_requests', 
          { status: 'sent', response_id: info.messageId },
          { email, name: userName, status: 'pending' }
        );
        
        res.status(200).json({
          success: true,
          msg: "Email sent successfully",
          status: info.response,
        });
      }
    });
  } catch (error) {
    console.log("Server error in contactUsEmail:", error.message);
    return res.status(500).json({
      success: false,
      msg: "Server internal error",
      error: error.message
    });
  }
};

/**
 * Handle newsletter subscription
 * @route POST /api/subscribeEmail
 */
module.exports.subscribeEmail = async (req, res) => {
  const { email } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ 
        success: false,
        msg: "Email is required" 
      });
    }
    
    // Check if email already exists in subscribers
    const existingSubscriber = await dbUtil.findOne('newsletter_subscribers', { email });
    
    if (existingSubscriber) {
      return res.status(400).json({
        success: false,
        msg: "Email is already subscribed"
      });
    }
    
    // Add to subscribers
    await dbUtil.create('newsletter_subscribers', {
      email,
      status: 'active',
      subscribed_at: new Date()
    });
    
    // Send confirmation email
    const mailOptions = {
      from: "DigitalBlock.Exchange <noreply@digitalblock.exchange>",
      to: email,
      subject: "Subscription Confirmation",
      html: `
        <div>
          <h2>Thank you for subscribing!</h2>
          <p>You have successfully subscribed to DigitalBlock.Exchange newsletter.</p>
          <p>Stay tuned for updates on new features, listings, and promotions.</p>
        </div>
      `,
    };
    
    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("Error sending subscription confirmation:", error);
      } else {
        console.log("Confirmation email sent: " + info.response);
      }
    });
    
    return res.status(200).json({
      success: true,
      msg: "Subscribed successfully"
    });
  } catch (error) {
    console.log("Server error in subscribeEmail:", error.message);
    return res.status(500).json({
      success: false,
      msg: "Server internal error",
      error: error.message
    });
  }
};

/**
 * Unsubscribe from newsletter
 * @route POST /api/unsubscribeEmail
 */
module.exports.unsubscribeEmail = async (req, res) => {
  const { email, token } = req.body;
  
  try {
    if (!email) {
      return res.status(400).json({ 
        success: false,
        msg: "Email is required" 
      });
    }
    
    // Check if email exists in subscribers
    const subscriber = await dbUtil.findOne('newsletter_subscribers', { email });
    
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        msg: "Email not found in subscribers"
      });
    }
    
    // Update subscriber status
    await dbUtil.update('newsletter_subscribers', 
      { status: 'unsubscribed', unsubscribed_at: new Date() },
      { email }
    );
    
    return res.status(200).json({
      success: true,
      msg: "Unsubscribed successfully"
    });
  } catch (error) {
    console.log("Server error in unsubscribeEmail:", error.message);
    return res.status(500).json({
      success: false,
      msg: "Server internal error",
      error: error.message
    });
  }
};

/**
 * Send bulk newsletter
 * @route POST /api/sendNewsletter
 */
module.exports.sendNewsletter = async (req, res) => {
  const { subject, content, test_email } = req.body;
  
  try {
    if (!subject || !content) {
      return res.status(400).json({ 
        success: false,
        msg: "Subject and content are required" 
      });
    }
    
    // For test email
    if (test_email) {
      const mailOptions = {
        from: "DigitalBlock.Exchange <noreply@digitalblock.exchange>",
        to: test_email,
        subject: subject,
        html: content,
      };
      
      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log("Error sending test newsletter:", error);
          return res.status(500).json({
            success: false,
            msg: "Failed to send test newsletter",
            error: error.message,
          });
        } else {
          console.log("Test newsletter sent: " + info.response);
          return res.status(200).json({
            success: true,
            msg: "Test newsletter sent successfully",
          });
        }
      });
      
      return;
    }
    
    // Get all active subscribers
    const subscribers = await dbUtil.query({
      model: 'newsletter_subscribers',
      where: { status: 'active' }
    });
    
    if (subscribers.length === 0) {
      return res.status(404).json({
        success: false,
        msg: "No active subscribers found"
      });
    }
    
    // Create newsletter record
    const newsletter = await dbUtil.create('newsletters', {
      subject,
      content,
      status: 'sending',
      recipient_count: subscribers.length,
      sent_at: new Date()
    });
    
    // Send to all subscribers (in batches in a real implementation)
    let successCount = 0;
    let failCount = 0;
    
    // This would be handled by a queue in production
    for (const subscriber of subscribers) {
      const mailOptions = {
        from: "DigitalBlock.Exchange <noreply@digitalblock.exchange>",
        to: subscriber.email,
        subject: subject,
        html: content,
      };
      
      try {
        await new Promise((resolve, reject) => {
          transporter.sendMail(mailOptions, function (error, info) {
            if (error) {
              failCount++;
              reject(error);
            } else {
              successCount++;
              resolve(info);
            }
          });
        });
      } catch (error) {
        console.log(`Failed to send to ${subscriber.email}:`, error);
      }
    }
    
    // Update newsletter status
    await dbUtil.update('newsletters', 
      { 
        status: 'completed', 
        success_count: successCount,
        fail_count: failCount,
        completed_at: new Date()
      },
      { id: newsletter.id }
    );
    
    return res.status(200).json({
      success: true,
      msg: "Newsletter sent",
      data: {
        total: subscribers.length,
        success: successCount,
        failed: failCount
      }
    });
  } catch (error) {
    console.log("Server error in sendNewsletter:", error.message);
    return res.status(500).json({
      success: false,
      msg: "Server internal error",
      error: error.message
    });
  }
};
