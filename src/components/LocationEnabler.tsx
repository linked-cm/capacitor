import React, { useState } from 'react';
import { Geolocation } from '@capacitor/geolocation';
import { Label } from '@_linked/primitives/components/Label';
import { Switch } from '@_linked/primitives/components/Switch';
import style from './LocationEnabler.module.css';
import { useAuth } from '@_linked/auth/hooks/useAuth';
import { LocationUpdateAction } from '../shapes/LocationUpdateAction.js';

interface LocationEnablerProps {
  onEnableLocationChange?: (enabled: boolean) => void;
}

export const LocationEnabler = ({
  onEnableLocationChange,
}: LocationEnablerProps) => {
  const auth = useAuth<any, any>();
  const userAccount = auth.userAccount;
  const [enableLocation, setEnableLocation] = useState<boolean>(
    Boolean(userAccount?.enabledLocationServices)
  );
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

          if (result && userAccount) {
            userAccount.enabledLocationServices = true;
            onEnableLocationChange?.(true);
          }
        } catch (err) {
          console.error('update location error:', err);
        }
      }
    } catch (err) {
      console.warn('request permission error:', err);
    }
  };
  const handleEnableLocation = (checked: boolean) => {
    setEnableLocation(checked);
    if (!checked) {
      if (userAccount) {
        userAccount.enabledLocationServices = false;
      }
      onEnableLocationChange?.(false);
      return;
    }
    getLocation();
  };

  return (
    <div className={style.row}>
      <Label htmlFor="enable-location-services">Enable location services</Label>
      <Switch
        id="enable-location-services"
        checked={Boolean(enableLocation)}
        onCheckedChange={handleEnableLocation}
      />
    </div>
  );
};
