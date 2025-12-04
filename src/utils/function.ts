import axios from "axios"
import { translate } from "free-translate"
import { Booking } from "../entities/Booking";
import { Between, getRepository, Like, Not, Or } from "typeorm";
import moment from "moment";

let googledistance_key = process.env.GOOGLE_API_KEY || "AIzaSyB0V1g5YyGB_NE1Lw1QitZZGECA5-1Xnng"

export const convert_degrees_To_radians = (degrees: number): number => {
    return degrees * (Math.PI / 180);
};

export const calculate_distance_between_coordinates = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const earthRadiusInKm = 6378.1370;
    const deltaLatitude = convert_degrees_To_radians(lat2 - lat1);
    const deltaLongitude = convert_degrees_To_radians(lon2 - lon1);
    const a =
        Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
        Math.cos(convert_degrees_To_radians(lat1)) *
        Math.cos(convert_degrees_To_radians(lat2)) *
        Math.sin(deltaLongitude / 2) *
        Math.sin(deltaLongitude / 2);

    const centralAngle = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = earthRadiusInKm * centralAngle;
    return distance;
};

export const calculate_age = (dateString: string): number => {
    const [day, month, year] = dateString.split("/").map(Number);
    const birthDate = new Date(year, month - 1, day);
    const currentDate = new Date();
    let age = currentDate.getFullYear() - birthDate.getFullYear();
    const hasBirthdayPassedThisYear =
        currentDate.getMonth() > birthDate.getMonth() ||
        (currentDate.getMonth() === birthDate.getMonth() && currentDate.getDate() >= birthDate.getDate());
    if (!hasBirthdayPassedThisYear) {
        age--;
    }
    return age;
};

export const distance_checker = async (units: 'metric' | 'imperial', origins: string, destinations: string) => {
    try {
        const apiKey = process.env.GOOGLE_API_KEY || googledistance_key;
        if (!apiKey) {
            throw new Error('Google Distance API key is missing.');
        }

        const apiUrl = `https://maps.googleapis.com/maps/api/distancematrix/json?units=${units}&origins=${encodeURIComponent(
            origins
        )}&destinations=${encodeURIComponent(destinations)}&key=${apiKey}`;

        const response = await axios.get(apiUrl);

        if (response.status !== 200) {
            throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
        }

        const distanceObj = response.data?.rows?.[0]?.elements?.[0];

        if (distanceObj?.status === 'OK' && distanceObj.distance) {
            const { text: distance, value: distanceValue } = distanceObj.distance;
            return { distance, distanceValue };
        } else {
            return `No distance information available. Status: ${distanceObj?.status || 'UNKNOWN'}`;
        }
    } catch (error: any) {
        console.error('Error fetching distance:', error.message || error);
        return `Error fetching distance: ${error.message || 'Unknown error'}`;
    }
};

export const directions_between_pickup_dropp_point = async (origins: string, destinations: string) => {
    try {
        const googleApiKey = process.env.GOOGLE_API_KEY;
        const response = await axios.get('https://maps.googleapis.com/maps/api/directions/json', {
            params: {
                origin: origins,
                destination: destinations,
                key: googleApiKey,
            },
        });

        const { routes, status } = response.data;
        console.log(response.data);

        if (status !== '200') {
            throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
        }

        const route = routes[0]; // Assuming the first route is the desired one
        const legs = route.legs; // Array of legs in the route (can contain intermediate stops)

        return { legs };
    } catch (error: any) {
        console.error('Error fetching distance:', error.message || error);
        return `Error fetching distance: ${error.message || 'Unknown error'}`;
    }
};

export const generate_password = (len: number) => {
    let password = "";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const digits = "1234567890";
    const special = "!@#$%&";
    const allChars = lowercase + uppercase + digits + special;
    password += lowercase.charAt(Math.floor(Math.random() * lowercase.length));
    password += uppercase.charAt(Math.floor(Math.random() * uppercase.length));
    password += digits.charAt(Math.floor(Math.random() * digits.length));
    password += special.charAt(Math.floor(Math.random() * special.length));
    for (let i = password.length; i < len; i++) {
        password += allChars.charAt(Math.floor(Math.random() * allChars.length));
    }
    password = password.split('').sort(() => Math.random() - 0.5).join('');
    return password;
};

// export const language_converter = async (text: string, targetLanguage: string) => {
//     try {
//         if (typeof Intl.DisplayNames === "function") {
//             const displayNames = new Intl.DisplayNames(['hi'], { type: 'language' });
//             const code = { lang: 'fr' };

//             const languagesWithNames = {
//                 code: code.lang,
//                 name: displayNames.of(code.lang) 
//             };
//             console.log(languagesWithNames);
//         } else {
//             console.error("Intl.DisplayNames is not supported in this environment.");
//         }
//     } catch (error: any) {
//         console.error('Translation error:', error);
//     }
// }

export const language_converter = async (text: string, from: any, to: any) => {
    try {
        const translatedText = await translate(text, { from: from, to: to });
        return translatedText;
    } catch (error: any) {
        console.error('Translation error:', error);
    }
};

export const getLanguages = async () => {
    try {
        const response = await axios.get('https://restcountries.com/v3.1/all');
        const countries = response.data;

        const languages = countries.map((country: any) => ({
            country: country.name.common,
            languages: country.languages,
        }));

        console.log(languages);
        return languages;
    } catch (error) {
        console.error('Error fetching languages:', error);
        throw error;
    }
};

export const get_lat_long = async (city_address: string) => {
    try {
        const googleApiKey = process.env.GOOGLE_API_KEY;

        // Make a GET request to the Google Maps Geocoding API
        const response = await axios.get('https://maps.googleapis.com/maps/api/geocode/json', {
            params: {
                address: `${city_address}`, // Properly pass the address parameter
                key: googleApiKey, // API key
            },
        });

        const { results, status } = response.data;

        // Check if results are available and return the lat/lng
        if (status === 'OK' && results.length > 0) {
            const { lat, lng } = results[0].geometry.location;
            return { lat, lng }; // Return the data as an object
        } else {
            throw new Error('No results found'); // Throw an error if no results
        }
    } catch (error: any) {
        throw new Error(error.message || 'An error occurred while fetching lat/long'); // Rethrow the error
    }
};

export const getNextDay = (currentDate: Date): Date => {
    const nextDay = new Date(currentDate);
    nextDay.setDate(currentDate.getDate() + 1);
    return nextDay;
};

const existingGuestIDs = new Set<string>();

export const generateGuestUserUniqueId = async () => {
    let uniqueID: string;
    const timestamp = Date.now();
    do {
        uniqueID = `guest-${timestamp}${Math.random().toString(36).substr(2, 9)}`;
    } while (existingGuestIDs.has(uniqueID));
    existingGuestIDs.add(uniqueID);
    return uniqueID;
};

export const generateBookingNumber = async (dateString: string) => {
    const bookingRepo = getRepository(Booking);
    const count = await bookingRepo.count({
        where: {
            travel_date: dateString,
        },
    });

    const sequence = (count + 1).toString().padStart(3, "0");
    return `${dateString.replace(/-/g, '')}${sequence}`;
};

export const generateTransactionNumber = async (dateString: string) => {
    const bookingRepo = getRepository(Booking);

    const count = await bookingRepo.count({
        where: {
            travel_date: dateString,
        },
    });

    const sequence = (count + 1).toString().padStart(3, "0");
    return `TNX${dateString.replace(/-/g, '')}${sequence}`;
};

export const convertToMatchFormat = (time: string | String) => {
  return moment(time.toString(), "DD-MM-YYYY HH:mm").format("YYYY-MM-DD HH:mm");
};