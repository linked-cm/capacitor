import { Server } from '@_linked/server-utils/utils/Server';
import { linkedShape, packageName } from '../package.js';
import { UpdateAction } from '@_linked/schema/shapes/UpdateAction';
import { capacitor } from '../ontologies/capacitor.js';

@linkedShape
export class LocationUpdateAction extends UpdateAction {
  static targetClass = capacitor.LocationUpdateAction;

  /**
   * update user location
   *
   * @param latitude
   * @param longitude
   */
  static async updateUserLocation(latitude: number, longitude: number) {
    return Server.call(packageName, 'updateUserLocation', latitude, longitude)
      .then((result) => {
        return result;
      })
      .catch((err) => {
        console.log('Update user location failed', err);
        throw new Error(err);
      });
  }
}
