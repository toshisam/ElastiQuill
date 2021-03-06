import express from "express";
import asyncHandler from "express-async-handler";

import * as emails from "../services/emails";
import * as recaptcha from "../services/recaptcha";
import * as blogPosts from "../services/blogPosts";

const router = express.Router();

router.get("/", (req, res) => {
  res.render("contact", {
    sidebarWidgetData: res.locals.sidebarWidgetData,
    recaptchaClientKey: recaptcha.clientKey(),
  });
});

router.post(
  "/",
  asyncHandler(async (req, res) => {
    if (req.body["contact-form-initial-value"]) {
      res.render("contact", {
        values: {
          item_id: req.body["contact-form-item-id"],
          content: req.body["contact-form-initial-value"] + "\n\n",
        },
        sidebarWidgetData: res.locals.sidebarWidgetData,
        recaptchaClientKey: recaptcha.clientKey(),
      });
      return;
    }

    let recipientEmail = null;

    if (req.body["item_id"]) {
      try {
        const item = await blogPosts.getItemById({ id: req.body["item_id"] });
        recipientEmail = item.author.email;
      } catch (err) {
        if (err.meta.statusCode !== 404) {
          throw err;
        }
      }
    }

    let error = null;
    let validity = null;

    try {
      if (recaptcha.isAvailable()) {
        const success = await recaptcha.verify(
          req.body["g-recaptcha-response"]
        );
        if (!success) {
          const captchaErr = new Error();
          captchaErr.isRecaptcha = true;
          throw captchaErr;
        }
      }

      await emails.sendContactMessage({
        name: req.body["name"],
        email: req.body["email"],
        subject: req.body["subject"],
        content: req.body["content"],
        recipient: recipientEmail,
      });
    } catch (err) {
      if (err.isRecaptcha) {
        error = "Invalid recaptcha";
      } else if (err.isJoi) {
        validity = {};
        err.details.forEach(err => {
          validity[err.path] = "has-error";
        });
        error = "Please fill all required fields";
      } else {
        throw err;
      }
    }

    res.render("contact", {
      validity,
      sidebarWidgetData: res.locals.sidebarWidgetData,
      recaptchaClientKey: recaptcha.clientKey(),
      error: error,
      values: error ? req.body : null,
      success: !error,
    });
  })
);

export default router;
