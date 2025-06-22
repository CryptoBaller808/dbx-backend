const transporter = require("../util/utils");

// @route POST /api/contactUsEmail
module.exports.contactUsEmail = async (req, res) => {
  const { email, userName, mailSubject, mailDescription } = req.body;
  try {
    if (email !== "" && userName !== "") {
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
          console.log("error on send email for reset password URL!", error);
          return res.status(401).json({
            message: `Email, and Detail are required`,
            error: error,
          });
        } else {
          console.log("Email sent: " + info.response);
          res.status(200).json({
            message: "Email Sent Successfully",
            status: info.response,
          });
        }
      });
    } else {
      return res
        .status(401)
        .json({ errors: [{ msg: `Email, and Detail are required` }] });
    }
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(`Server internal error! ${error.message}`);
  }
};

// @route POST /api/subscribeEmail
module.exports.subscribeEmail = async (req, res) => {
  console.log("Subscribe Email API call");
  const { email } = req.body;
  try {
    if (email !== "") {
      const mailOptions = {
        from: email,
        to: "digitalblockexchange@gmail.com",
        replyTo: email,
        subject: "Email Subscription",
        html: `
          <div>
            <p>Subscribed by: ${email}</p>
          </div>
        `,
      };

      transporter.sendMail(mailOptions, function (error, info) {
        if (error) {
          console.log("error on send email for reset password URL!", error);
          return res
            .status(401)
            .json({ message: `Email required`, error: error });
        } else {
          console.log("Email sent: " + info.response);
          res.status(200).json({
            message: "Email subscribed successfully!",
            status: info.response,
          });
        }
      });
    } else {
      return res
        .status(401)
        .json({ errors: [{ msg: `Email, and Detail are required` }] });
    }
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(`Server internal error! ${error.message}`);
  }
};

// @route POST /api/listingApplicationEmail
module.exports.listingApplicationEmail = async (req, res) => {
  console.log("Listing Application Email API call");
  const { companyInfo, contactInfo, projectInfo, tokenInfo } = req.body;

  const { contactName, contactTitle, contactEmail, contactNumber } =
    contactInfo;
  const { companyBriefIntro, companyName, companyAddress, companyCoreInfo } =
    companyInfo;
  const {
    t_name,
    t_symbol,
    t_contract_address,
    t_total_supply,
    t_total_circulation,
    link,
  } = tokenInfo;
  const { description, linkRoadMap, currentStage, whitePaperLink, githubLink } =
    projectInfo;

  try {
    const mailOptions = {
      from: contactEmail,
      to: "digitalblockexchange@gmail.com",
      replyTo: contactEmail,
      subject: "Listing Application",
      html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px;">
        <h2>Listing Application Details</h2>
  
        <h3>Contact Information</h3>
        <p>Name: ${contactName}</p>
        <p>Title: ${contactTitle}</p>
        <p>Email: ${contactEmail}</p>
        <p>Contact Number: ${contactNumber}</p>
  
        <h3>Company Information</h3>
        <p>Brief Introduction: ${companyBriefIntro}</p>
        <p>Company Name: ${companyName}</p>
        <p>Address: ${companyAddress}</p>
        <p>Core Information: ${companyCoreInfo}</p>
  
        <h3>Token Information</h3>
        <p>Name: ${t_name}</p>
        <p>Symbol: ${t_symbol}</p>
        <p>Contract Address: ${t_contract_address}</p>
        <p>Total Supply: ${t_total_supply}</p>
        <p>Total Circulation: ${t_total_circulation}</p>
        <p>Token Link: ${link}</p>
  
        <h3>Project Information</h3>
        <p>Description: ${description}</p>
        <p>RoadMap Link: ${linkRoadMap}</p>
        <p>Current Stage: ${currentStage}</p>
        <p>White Paper Link: ${whitePaperLink}</p>
        <p>Github Link: ${githubLink}</p>
  
      </div>
    `,
    };

    transporter.sendMail(mailOptions, function (error, info) {
      if (error) {
        console.log("error on send email for reset password URL!", error);
        return res
          .status(401)
          .json({ message: `Email required`, error: error });
      } else {
        console.log("Email sent: " + info.response);
        res.status(200).json({
          message: "Email subscribed successfully!",
          status: info.response,
        });
      }
    });
  } catch (error) {
    console.log(error.message);
    return res.status(500).json(`Server internal error! ${error.message}`);
  }
};
