import { createContext, useContext } from 'react';
import type { MakeDesignPresentation } from './types';

export const emptyMakeDesign: MakeDesignPresentation = Object.freeze({});
export const MakeDesignContext = createContext<MakeDesignPresentation>(emptyMakeDesign);
export const useMakeDesign = () => useContext(MakeDesignContext);
