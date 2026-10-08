import React, { useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { FormControlLabel } from '@_linked/mui-base/components/FormControlLabel';
import { Switch } from '@_linked/mui-base/components/Switch';
import { useAuth } from '@_linked/auth/hooks/useAuth';
import { LocationUpdateAction } from '../shapes/LocationUpdateAction.js';

export const LocationEnabler = (onEnableLocationChange) => {
  const auth = useAuth<any, any>();
  const userAccount = auth.userAccount;
  const [enableLocation, setEnableLocation] = useState<boolean>(
    userAccount.enabledLocationServices
  );
  // get location of current location and request permission to activate location
  const getLocation = async () => {
    try {
      const coordinates = await Geolocation.getCurrentPosition();
      if (coordinates) {
        try {
          const { latitude, longitude } = coordinates.coords;
          const result = await LocationUpdateAction.updateUserLocation(
            latitude,
            longitude
          );

          if (result) {
            // set enabledLocationServices to true
            // and then navigate
            userAccount.enabledLocationServices = true;
            onEnableLocationChange(true);
          }
        } catch (err) {
          console.error('update location error:', err);
        }
      }
    } catch (err) {
      console.warn('request permission error:', err);
    }
  };
  // Toggle Switch enable location
  const handleEnableLocation = () => {
    setEnableLocation(!enableLocation);
    getLocation();
  };

  return (
    <FormControlLabel
      control={
        <Switch checked={enableLocation} onChange={handleEnableLocation} />
      }
      labelPlacement="start"
      label={`Enable location services`}
    />
  );
};
