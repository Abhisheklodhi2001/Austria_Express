export interface IUser {
    id: number;
    first_name?: string;
    last_name?: string;
    mobile_number?: string;
    email: string;
    show_password?: string;
    password?: string;
    profile_image?: string;
    jwt_token?: string;
    reset_password_token?: string | null;
    reset_password_token_expiry?: Date | null;
    verify_token?: string | null;
    verify_token_expiry?: Date | null;
    is_verified: boolean;
    is_blocked: boolean;
    signup_method?: string;
    created_at: Date;
    updated_at: Date;
}
