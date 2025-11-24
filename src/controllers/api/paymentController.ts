import Joi from "joi";
import axios from "axios";
import ejs, { name } from "ejs";
import path from "path";
import crypto from "crypto";
import { Request, Response } from "express";
import { IUser } from "../../models/User";
import { getRepository } from "typeorm";
import { User } from "../../entities/User";
import { handleError } from "../../utils/responseHandler";
import Stripe from "stripe";
import { Transaction } from "../../entities/Transaction";
import { Booking } from "../../entities/Booking";
import { generateTransactionNumber } from "../../utils/function";
import { sendEmail } from "../../services/otpService";
import { CurrencyExchangeRate } from "../../entities/currency_exchange_rate";
import moment from "moment";

export const createStripeCheckoutSession = async (req: Request, res: Response) => {
  const bookingSchema = Joi.object({
    booking_id: Joi.string().required(),
    from_ukraine: Joi.boolean().required().allow(true, false),
    amount: Joi.number().positive().required(),
    amount_paid: Joi.number().min(0).required(),
    currency: Joi.string().required(),
    payment_method: Joi.string().required(),
    travel_date: Joi.string().isoDate().required()
  });

  const { error, value } = bookingSchema.validate(req.body);
  if (error) return handleError(res, 400, error.details[0].message);

  const user_req = req.user as IUser;
  const { booking_id, from_ukraine, amount, amount_paid, currency, payment_method, travel_date } = value;

  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  try {
    const userRepository = getRepository(User);
    const currencyExchangeRepository = getRepository(CurrencyExchangeRate);

    const user = await userRepository.findOneBy({ id: user_req.id });

    if (!user) return handleError(res, 404, "User Not Found");

    let customerId = user?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        name: `${user.first_name} ${user.last_name}`,
      });
      user.stripe_customer_id = customer.id;
      await userRepository.save(user);
      customerId = customer.id;
    }

    let exchangeRate = 1;
    if (from_ukraine) {
      const currencyData = await currencyExchangeRepository.findOne({
        where: {
          from_currency: 'EUR',
          to_currency: 'UAH'
        }
      });

      if (currencyData) {
        exchangeRate = Number(currencyData.rate) || 1;
      } else {
        console.warn(`Exchange rate not found for -> ${exchangeRate}`);
      }
    }
    const amountInCents = Math.round(Number(amount_paid) * 100);
    const convertedAmount = Number((amountInCents / exchangeRate).toFixed(0));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: [payment_method],
      mode: "payment",
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: { name: "Bus Ticket Payment" },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${process.env.APP_URL}api/stripe-payment-success?session_id={CHECKOUT_SESSION_ID}&user_id=${user_req.id}&amount=${amount}&booking_id=${booking_id}&from_ukraine=${from_ukraine}&travel_date=${travel_date}`,
      cancel_url: `${process.env.APP_URL}api/stripe-payment-cancelled?session_id={CHECKOUT_SESSION_ID}&user_id=${user_req.id}&booking_id=${booking_id}&from_ukraine=${from_ukraine}&travel_date=${travel_date}`,
      payment_intent_data: {
        setup_future_usage: "off_session",
      },
    });

    return res.json({ success: true, url: session.url });
  } catch (error: any) {
    return res.status(500).json({
      error: true,
      message: `Internal server error + ' ' + ${error}`,
      status: 500,
      success: false,
    });
  }
};

export const stripePaymentSuccess = async (req: Request, res: Response) => {
  const bookingSchema = Joi.object({
    session_id: Joi.string().required(),
    user_id: Joi.number().positive().required(),
    amount: Joi.number().min(0).required(),
    booking_id: Joi.string().required(),
    from_ukraine: Joi.required().allow(true, false),
    travel_date: Joi.string().isoDate().required()
  });

  const { error, value } = bookingSchema.validate(req.query);
  if (error) return handleError(res, 400, error.details[0].message);

  const { session_id, user_id, amount, booking_id, from_ukraine, travel_date } = value;

  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(
      session_id as string
    );
    const paymentIntent = await stripe.paymentIntents.retrieve(
      session.payment_intent as string
    );
    const paymentMethod = await stripe.paymentMethods.retrieve(
      paymentIntent.payment_method as string
    );

    if (!session || session.payment_status !== "paid")
      return handleError(res, 400, "Payment not successful");

    const transactionRepository = getRepository(Transaction);
    const bookingRepository = getRepository(Booking);

    const booking = await bookingRepository.findOne({
      where: { id: booking_id },
      relations: ["route", "from", "to"],
    });
    if (!booking) return handleError(res, 404, "Booking not found");

    const transaction = transactionRepository.create({
      transaction_number: await generateTransactionNumber(moment(travel_date).format("DD-MM-YYYY")),
      booking: booking,
      user: user_id,
      amount: Number(amount),
      amount_paid: Number(session.amount_total?.toString() ?? 0) / 100 || 0,
      currency: session.currency || "unknown",
      payment_method: session.payment_method_types[0] || "unknown",
      payment_type: "Stripe",
      status: "completed",
      external_transaction_id: String(session.payment_intent) || "unknown",
      description: "Bus ticket payment",
      payment_details: JSON.stringify(paymentMethod),
    });

    await transactionRepository.save(transaction);

    booking.payment_status = true;
    await bookingRepository.save(booking);

    const emailTemplatePath = path.resolve(
      __dirname,
      "../../views/booking.ejs"
    );
    const emailHtml = await ejs.renderFile(emailTemplatePath, {
      bookingNumber: booking.booking_number,
      first_name: booking.first_name,
      last_name: booking.last_name,
      email: booking.email,
      phone: booking.phone,
      total: from_ukraine == 'true' ? booking.total + '₴' : booking.total + '€',
      departure_time: booking.departure_time,
      arrival_time: booking.arrival_time,
      payment_method: booking.payment_method,
      route_name: booking.route.title,
      from_city: booking.from.city_name,
      to_city: booking.to.city_name,
    });

    const emailOptions = {
      to: booking.email,
      subject: "Your Ticket Has Been Successfully Booked",
      html: emailHtml,
    };
    await sendEmail(emailOptions);

    res.redirect(`${process.env.FRONTEND_URL}ticket-details?id=${booking_id}`);
  } catch (error: any) {
    console.log(error);

    return res.status(500).json({
      error: true,
      message: `Internal server error + ' ' + ${error}`,
      status: 500,
      success: false,
    });
  }
};

export const stripePaymentCancelled = async (req: Request, res: Response) => {
  const bookingSchema = Joi.object({
    session_id: Joi.string().required(),
    user_id: Joi.number().positive().required(),
    booking_id: Joi.string().required(),
    from_ukraine: Joi.required().allow(true, false),
    travel_date: Joi.string().isoDate().required()
  });

  const { error, value } = bookingSchema.validate(req.query);
  if (error) return handleError(res, 400, error.details[0].message);

  const { session_id, user_id, booking_id, from_ukraine, travel_date } = value;
  try {
    const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY as string;
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.retrieve(session_id);

    const transactionRepository = getRepository(Transaction);
    const bookingRepository = getRepository(Booking);

    const booking = await bookingRepository.findOneBy({ id: Number(booking_id) });

    const amount = Number(session.amount_total?.toString() ?? 0) / 100 || 0;

    if (!booking) {
      const message = `The payment of $${from_ukraine == 'true' ? amount + '₴' : amount + '€'} using ${session.payment_method_types[0]} was cancelled. Please try again.`;

      return res.render(
        path.join(__dirname, "../../views/", "payment_cancelled.ejs"),
        {
          message,
          amount,
          paymentMethod: session.payment_method_types[0],
        }
      );
    }

    const transaction = transactionRepository.create({
      transaction_number: await generateTransactionNumber(moment(travel_date).format("DD-MM-YYYY")),
      booking: booking,
      user: user_id,
      amount: Number(amount),
      amount_paid: Number(session.amount_total?.toString() ?? 0) / 100 || 0,
      currency: session.currency || "unknown",
      payment_method: session.payment_method_types[0] || "unknown",
      payment_type: "Stripe",
      status: "failed",
      external_transaction_id: String(session.payment_intent) || "unknown",
      description: "Bus ticket payment",
      payment_details: null,
    });

    await transactionRepository.save(transaction);

    booking.payment_status = false;
    await bookingRepository.save(booking);

    const message = `The payment of ${from_ukraine == 'true' ? amount + '₴' : amount + '€'} using ${session.payment_method_types[0]} was cancelled. Please try again.`;

    res.render(path.join(__dirname, "../../views/", "payment_cancelled.ejs"), {
      message,
      amount,
      paymentMethod: session.payment_method_types[0],
    });
  } catch (error: any) {
    return res.status(500).json({
      error: true,
      message: `Internal server error + ' ' + ${error}`,
      status: 500,
      success: false,
    });
  }
};

export const createLiqpayCheckoutSession = async (
  req: Request,
  res: Response
) => {
  const bookingSchema = Joi.object({
    booking_id: Joi.string().required(),
    amount: Joi.number().positive().required(),
    amount_paid: Joi.number().min(0).required(),
    currency: Joi.string().required(),
    payment_method: Joi.string().required(),
  });

  const { error, value } = bookingSchema.validate(req.body);
  if (error) return handleError(res, 400, error.details[0].message);

  const user_req = req.user as IUser;
  const { booking_id, amount, amount_paid, currency, payment_method } = value;

  const LIQPAY_PUBLIC_KEY = process.env.LIQPAY_PUBLIC_KEY as string;
  const LIQPAY_SECRET_KEY = process.env.LIQPAY_SECRET_KEY as string;
  try {
    const userRepository = getRepository(User);
    const user = await userRepository.findOneBy({ id: user_req.id });

    if (!user) return handleError(res, 404, "User Not Found");

    const order_id = `order_${booking_id}_${Date.now()}`;

    const paymentData = {
      version: "3",
      public_key: LIQPAY_PUBLIC_KEY,
      action: "pay",
      amount: amount.toFixed(2),
      currency,
      order_id,
      result_url: `${process.env.APP_URL}api/liqpay-payment-success`,
      cancel_url: `${process.env.APP_URL}api/liqpay-payment-cancelled`,
      server_url: `${process.env.APP_URL}api/liqpay-webhook`,
      paytypes: payment_method,
    };

    const dataString = Buffer.from(JSON.stringify(paymentData)).toString(
      "base64"
    );
    const signature = crypto
      .createHash("sha1")
      .update(LIQPAY_SECRET_KEY + dataString + LIQPAY_SECRET_KEY)
      .digest("base64");

    const paymentUrl = `https://www.liqpay.ua/api/3/checkout?data=${encodeURIComponent(
      dataString
    )}&signature=${encodeURIComponent(signature)}`;

    res.json({ success: true, url: paymentUrl, order_id });
  } catch (error: any) {
    return res.status(500).json({
      error: true,
      message: `Internal server error + ' ' + ${error}`,
      status: 500,
      success: false,
    });
  }
};

export const liqpayPaymentSuccess = async (req: Request, res: Response) => {
  const bookingSchema = Joi.object({
    data: Joi.string().required(),
    signature: Joi.string().required(),
  });

  const { error, value } = bookingSchema.validate(req.body);
  if (error) return handleError(res, 400, error.details[0].message);

  const { data, signature } = value;

  const LIQPAY_SECRET_KEY = process.env.LIQPAY_SECRET_KEY as string;
  try {
    const expectedSignature = crypto
      .createHash("sha1")
      .update(LIQPAY_SECRET_KEY + data + LIQPAY_SECRET_KEY)
      .digest("base64");

    if (signature !== expectedSignature)
      return res
        .status(400)
        .json({ error: true, message: "Invalid signature" });

    const decodedData = JSON.parse(
      Buffer.from(data, "base64").toString("utf-8")
    );

    const { order_id, amount, currency, status, transaction_id, paytype, travel_date } =
      decodedData;

    if (
      status === "failure" ||
      status === "error" ||
      status === "reversed" ||
      status !== "success"
    ) {
      return res.redirect(`${process.env.APP_URL}api/liqpay-payment-cancelled`);
    }

    const transactionRepository = getRepository(Transaction);
    const bookingRepository = getRepository(Booking);

    const booking_id = order_id.split("_")[1];
    const booking = await bookingRepository.findOneBy({
      id: Number(booking_id),
    });
    if (!booking) return handleError(res, 404, "Booking not found");

    const transaction = transactionRepository.create({
      transaction_number: await generateTransactionNumber(moment(travel_date).format("DD-MM-YYYY")),
      booking,
      user: booking.booking_user_id,
      amount: Number(amount),
      amount_paid: Number(amount),
      currency,
      payment_method: paytype,
      payment_type: "LiqPay",
      status: "completed",
      external_transaction_id: transaction_id,
      description: "Bus ticket payment via LiqPay",
    });

    await transactionRepository.save(transaction);

    booking.payment_status = true;
    await bookingRepository.save(booking);

    res.redirect(`${process.env.FRONTEND_URL}ticket-details?id=${booking_id}`);
  } catch (error: any) {
    return res.status(500).json({
      error: true,
      message: `Internal server error + ' ' + ${error}`,
      status: 500,
      success: false,
    });
  }
};

export const liqpayPaymentCancelled = async (req: Request, res: Response) => {
  try {
    // const LIQPAY_SECRET_KEY = process.env.LIQPAY_SECRET_KEY as string;
    // const expectedSignature = crypto.createHash("sha1").update(LIQPAY_SECRET_KEY + data + LIQPAY_SECRET_KEY).digest("base64");
    // // if (signature !== expectedSignature) return res.status(400).json({ error: true, message: "Invalid signature" });
    // const decodedData = JSON.parse(Buffer.from(data, "base64").toString("utf-8"));
    // const { order_id, amount, currency, paytype } = decodedData;
    // const message = `The payment of ${currency} ${amount} using ${paytype} was cancelled. Please try again.`;
    // res.render(path.join(__dirname, "../../views/", "payment_cancelled.ejs"), {
    //     message,
    //     amount,
    //     paymentMethod: paytype,
    // });
  } catch (error: any) {
    return res.status(500).json({
      error: true,
      message: `Internal server error: ${error.message}`,
    });
  }
};

export const liqpayPaymentWebhook = async (req: Request, res: Response) => {
  try {
    const data = req.body;
    console.log("LiqPay Webhook:", data);
  } catch (error: any) {
    return res.status(500).json({
      error: true,
      message: `Internal server error + ' ' + ${error}`,
      status: 500,
      success: false,
    });
  }
};
