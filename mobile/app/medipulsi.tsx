import React from 'react';
import {Redirect} from 'expo-router';
/** Backwards-compatible app link: the game now belongs to native MEDIRUN. */
export default function MedipulsiScreen(){return <Redirect href="/run"/>;}
