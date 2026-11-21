'use client';

import React from 'react';

import { Header } from '../landing-bn/chrome';
import { useSignedIn } from '../landing-bn/use-signed-in';

export const LandingNavbar: React.FC = () => {
  const signedIn = useSignedIn();
  return <Header signedIn={signedIn} />

};

