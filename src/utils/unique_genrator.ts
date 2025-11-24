// import { getRepository } from "typeorm"
// import { CarBooking } from "../entities/CarBooking"

// export const generate_unique_reservation_number = async (): Promise<number> => {
//     const carBookingRepository = getRepository(CarBooking);
//     let isUnique = false;
//     let random_number = 0
//     while (!isUnique) {
//         random_number = Math.floor(Math.random() * 90000000 + 10000000);
//         const existingReservation = await carBookingRepository.findOne({ where: { reservation_number: random_number } });
//         if (!existingReservation) { isUnique = true; }
//     }
//     return random_number;
// }


