import { createNameSpace } from '@_linked/core/utils/NameSpace';

/**
 * Load the data of this ontology into memory
 */
export var loadData = () => {
  if (typeof module !== 'undefined' && typeof exports !== 'undefined') {
    // CommonJS import
    return import('../data/lincd-capacitor.json');
  } else {
    // ESM import
    //@ts-ignore
    return import('../data/lincd-capacitor.json', {
      with: { type: 'json' },
    }).then((data) => data.default);
  }
};

/**
 * The namespace of this ontology
 */
export var ns = createNameSpace('http://lincd.org/ont/lincd-capacitor/');

export var _self = ns('');

export var LocationUpdateAction = ns('LocationUpdateAction');

//An extra grouping object so all the entities can be accessed from the prefix/name
export const lincdCapacitor = {
  LocationUpdateAction,
};
