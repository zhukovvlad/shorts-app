import React from 'react'
import checkUser from '../lib/checkUser';
import CreateProject from './CreateProject';
import { userCredits } from '../lib/userCredits';

// Ensure this page is always dynamic so user/credits are fresh per request
export const dynamic = 'force-dynamic';

const NewPage = async () => {
  const user = await checkUser();
  const credits = await userCredits(user);

  return <CreateProject user={user} credits={credits} />
}

export default NewPage