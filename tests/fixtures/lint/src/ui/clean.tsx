import { useState } from 'react';
import { step } from '@engine/step';
import { locations } from '@content/regions/locations';
import { play } from '@audio/engine';

export function App(): unknown {
  const [n] = useState(0);
  console.log('ui may log', step, locations, play, n);
  return <p>{n}</p>;
}
