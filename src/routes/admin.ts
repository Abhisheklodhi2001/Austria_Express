import express from "express";
import { uploadFile } from "../services/uploadImage";
import { authenticateAdmin } from "../middlewares/auth";

//==================================== Import Controller ==============================
import * as authControllers from "../controllers/admin/authController";
import * as userControllers from "../controllers/admin/userController";
import * as roleControllers from "../controllers/role/roleController";
import * as routeControllers from "../controllers/admin/routeController";
import * as routeClosureControllers from "../controllers/admin/routeClosureController";
import * as routeDiscountControllers from "../controllers/admin/routediscountControler";
import * as ticketTypeControllers from "../controllers/admin/ticketTypeController";
import * as busControllers from "../controllers/admin/busController";
import * as busscheduleControllers from "../controllers/admin/busscheduleController";
import * as bookingControllers from "../controllers/admin/bookingController";
import * as cityControllers from "../controllers/admin/cityController";
import * as currencyExchangeControllers from "../controllers/admin/currencyExchangeController";
import * as contactUsControllers from "../controllers/admin/contactUsController";
import * as reportControllers from "../controllers/admin/reportController";
import * as settingsControllers from "../controllers/admin/settingController";
import * as ticketDescriptionControllers from "../controllers/admin/ticketDescriptionController";
import { get_lat_long } from "../utils/latlong";
import { get_location, get_address_by_latlong } from "../utils/searchLocation";

const router = express.Router();

//==================================== Auth ==============================
router.post("/register", authControllers.register_admin);
router.get("/verify-email", authControllers.verifyEmail);
router.post("/login", authControllers.login_admin);
router.post("/forgot-password", authControllers.forgot_password);
router.get("/reset-password", authControllers.render_forgot_password_page);
router.post("/reset-password", authControllers.reset_password);
router.post("/change-password", authenticateAdmin, authControllers.changePassword);
router.get("/profile", authenticateAdmin, authControllers.getProfile);
router.post("/profile-update", authenticateAdmin, uploadFile, authControllers.updateProfile);
router.get("/register-success", authControllers.render_success_register);
router.get("/success-reset", authControllers.render_success_reset);
router.get("/dashboard-details", authenticateAdmin, authControllers.dashboard_details);

//==================================== USER ==============================
router.get("/user-list", authenticateAdmin, userControllers.get_all_user_list);
router.post("/change-user-status", authenticateAdmin, userControllers.change_user_status);

//==================================== USER ==============================
router.get("/get-all-users", userControllers.getAllUsers);

//==================================== Role ==============================
router.post("/create-role", roleControllers.RolesController.createRole);
router.post("/get-roles", roleControllers.RolesController.getAllRoles);
router.post("/update-role", roleControllers.RolesController.updateRole);
router.post("/delete-role", roleControllers.RolesController.deleteRole);

//==================================== City ===============================
router.post("/create-city", cityControllers.createCity);
router.get("/get-all-city", cityControllers.getAllCity);
router.get("/get-city-by-id", cityControllers.getCityById);
router.post("/update-city", uploadFile, cityControllers.updateCity);
router.post("/delete-city", cityControllers.deleteCityById);
router.get("/get-all-active-city", cityControllers.getAllActiveCity);

//==================================== Route ==============================
router.post("/create-route", authenticateAdmin, routeControllers.create_route);
router.get("/get-all-routes", authenticateAdmin, routeControllers.get_all_routes);
router.get("/get-all-active-routes", authenticateAdmin, routeControllers.get_all_active_routes);
router.get("/get-all-routes-by-limit-search", authenticateAdmin, routeControllers.get_all_routes_by_search_limit);
router.post("/get-route-by-id", authenticateAdmin, routeControllers.get_route_by_id);
router.post("/update-route", authenticateAdmin, routeControllers.update_route);
router.post("/update-route-status", authenticateAdmin, routeControllers.update_route_status);
router.post("/delete-route", authenticateAdmin, routeControllers.delete_route);
router.post("/update-departuretime", authenticateAdmin, routeControllers.update_departuretime);
router.post("/create-copy-route", authenticateAdmin, routeControllers.create_copy_route);
router.post("/update-delete-route-status-by-id", authenticateAdmin, routeControllers.updateDeleteRouteStatusById);
router.get("/get-all-deleted-routes", authenticateAdmin, routeControllers.get_all_deleted_routes);
router.post("/get-all-booking-by-route-id", authenticateAdmin, routeControllers.get_all_booking_by_route_id);

//==================================== Route Closure ==============================
router.post("/create-closure", authenticateAdmin, routeClosureControllers.createRouteClosure);
router.get("/get-all-closures-by-limit-search", authenticateAdmin, routeClosureControllers.getRouteClosureSearchLimit);
router.post("/update-closure", authenticateAdmin, routeClosureControllers.updateRouteClosure);
router.post("/delete-closure", authenticateAdmin, routeClosureControllers.deleteRouteClosure);

//==================================== Ticket Type ==============================
router.post("/create-ticket-type", authenticateAdmin, ticketTypeControllers.add_ticket_type);
router.post("/delete-ticket-type", authenticateAdmin, ticketTypeControllers.delete_ticket_type);
router.get("/get-all-ticket-type", authenticateAdmin, ticketTypeControllers.get_all_ticket_type);
router.post("/get-ticket-type-by-routeid", ticketTypeControllers.get_ticket_type_by_routeid);
router.post("/get-ticket-type-by-route-line-id", ticketTypeControllers.get_ticket_type_by_route_lineid);
router.post("/update-ticket-price", authenticateAdmin, ticketTypeControllers.update_ticket_price);

//==================================== Bus ==============================
router.post("/create-bus", authenticateAdmin, busControllers.create_bus);
router.get("/get-all-buses", authenticateAdmin, busControllers.get_all_buses);
router.get("/get-all-buses-by-limit-search", authenticateAdmin, busControllers.getAllBusesBySearchLimit);
router.post("/update-bus", authenticateAdmin, busControllers.update_bus);
router.post("/update-bus-status", authenticateAdmin, busControllers.update_bus_status);
router.post("/delete-bus", authenticateAdmin, busControllers.delete_bus);
router.post("/bus-search", authenticateAdmin, busControllers.bus_search);

//==================================== Bus Schedule ==============================
router.post("/create-busschedule", authenticateAdmin, busscheduleControllers.create_busschedule);
router.get("/get-all-busschedule", authenticateAdmin, busscheduleControllers.get_all_busschedule);
router.post("/get-busschedule-byid", authenticateAdmin, busscheduleControllers.get_all_busschedule_byid);
router.post("/update-busschedule", authenticateAdmin, busscheduleControllers.update_busschedule);
router.post("/delete-busschedule", authenticateAdmin, busscheduleControllers.delete_busschedule);
router.post("/get-all-busschedule-by-routeid", authenticateAdmin, busscheduleControllers.get_all_busschedule_by_route_id);

//==================================== Booking ==============================
router.post("/create-booking", authenticateAdmin, bookingControllers.create_booking);
router.post("/get-all-booking", authenticateAdmin, bookingControllers.get_all_booking);
router.get("/get-booking-byid", authenticateAdmin, bookingControllers.get_booking_by_id);
router.post("/update-booking-byid", authenticateAdmin, bookingControllers.update_booking_by_id);
router.get("/delete-booking-byid", authenticateAdmin, bookingControllers.delete_booking_by_id);
router.post("/get-booking-by-route-date-and-from-to", authenticateAdmin, bookingControllers.get_booking_by_route_date_and_from_to);
router.get("/get-ticket-booking-by-booking-id", authenticateAdmin, bookingControllers.getTicketBookingByBookingId);
router.get("/get-ticket-booking-transaction", authenticateAdmin, bookingControllers.getTicketBookingTransactions);

//=================================== Lat Long ==========================
router.post("/get-lat-long", get_lat_long);

//=================================== Search Location ==========================
router.post("/get-location", get_location);
router.post("/get-address-latlong", get_address_by_latlong);

//=================================== Contact Us ==========================
router.get("/contact-us-search-with-limit", authenticateAdmin, contactUsControllers.getAllContactUsBySearchLimit);
router.post("/customer-query-responded", authenticateAdmin, contactUsControllers.customerQueryResponse);

//=================================== Currency Exchange ==========================
router.post("/add-currency-exchange", authenticateAdmin, currencyExchangeControllers.addCurrencyExchange);
router.get("/get-currency-exchange", authenticateAdmin, currencyExchangeControllers.getAllCurrencyExchange);
router.post("/update-exchange-by-id", authenticateAdmin, currencyExchangeControllers.updateCurrencyExchange);

//=================================== Report ==========================
router.post("/booking-report", authenticateAdmin, reportControllers.bookingReports);
router.post("/booking-ticket-type-report", authenticateAdmin, reportControllers.bookingReportsTypeOfTicket);
router.post("/earning-report", authenticateAdmin, reportControllers.earningReports);
router.post("/earning-ticket-type-report", authenticateAdmin, reportControllers.earningReportsTypeOfTicket);
router.get("/user-report", authenticateAdmin, reportControllers.userReports);
router.get("/upcoming-buses-report", authenticateAdmin, reportControllers.upcomingBusesReport);

//=================================== Route Discount ==========================
router.post("/add-routediscount", authenticateAdmin, routeDiscountControllers.addRouteDiscount);
router.get("/get-routediscount-by-id", authenticateAdmin, routeDiscountControllers.getRouteDiscountByRouteId);
router.post("/update-routediscount", authenticateAdmin, routeDiscountControllers.updateRouteDiscount);

//================================= service =====================================
router.post("/important-update", settingsControllers.createImportantUpdate);
router.post("/important-update/:id", settingsControllers.updateImportantUpdate);
router.delete("/important-update/:id", settingsControllers.deleteImportantUpdate);

router.post("/schedule-change", settingsControllers.createScheduleChange);
router.post("/schedule-change/:id", settingsControllers.updateScheduleChange);
router.delete("/schedule-change/:id", settingsControllers.deleteScheduleChange);

router.post("/service-alert", settingsControllers.createServiceAlert);
router.post("/service-alert/:id", settingsControllers.updateServiceAlert);
router.delete("/service-alert/:id", settingsControllers.deleteServiceAlert);

//===================================Ticket Description =======================//

router.post("/create-Ticket-Description", ticketDescriptionControllers.createTicketDescription);
router.post("/update-Ticket-Description/:id", ticketDescriptionControllers.updateTicketDescription);
router.get("/get-Ticket-Description", ticketDescriptionControllers.getTicketDescription);

export default router;
