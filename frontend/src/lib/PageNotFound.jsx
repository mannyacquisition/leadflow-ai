import { useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import { useEffect, useState } from "react";

export default function PageNotFound() {
    const navigate = useNavigate();
    const { isAuthenticated, isLoadingAuth } = useAuth();
    const [isChecked, setIsChecked] = useState(false);

    useEffect(() => {
        const checkAndRedirect = async () => {
            if (!isLoadingAuth) {
                setIsChecked(true);
                if (isAuthenticated) {
                    navigate('/Dashboard');
                } else {
                    navigate('/Login');
                }
            }
        };
        checkAndRedirect();
    }, [isAuthenticated, isLoadingAuth, navigate]);

    if (!isChecked) {
        return (
            <div className="fixed inset-0 flex items-center justify-center bg-white">
                <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
            </div>
        );
    }

    return null;
}
