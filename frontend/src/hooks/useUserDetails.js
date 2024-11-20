import { useState, useEffect } from "react";
import axios from "axios"; // You can use fetch if you don't want to use Axios

/**
 * Custom hook to fetch user details.
 * @returns {Object} { userDetails, isLoading, error }
 */
const useUserDetails = () => {
  const [userDetails, setUserDetails] = useState(null);
  const [userLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUserDetails = async () => {
      const userId = localStorage.getItem("userId");

      if (!userId) {
        setError("User ID is not available.");
        setIsLoading(false);
        return;
      }

      try {
        // Replace with your API endpoint for fetching user details 
       
        const response = await axios.get(`http://localhost:5167/api/users/${userId}`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`, // Optional: Add token for authorization
          },
        });

        setUserDetails(response.data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to fetch user details.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserDetails();
  }, []);

  return { userDetails, userLoading, error };
};

export default useUserDetails;
