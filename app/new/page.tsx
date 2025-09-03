import React from 'react'
import checkUser from '../lib/checkUser';
import CreateProject from './CreateProject';

const NewPage = async () => {
  const user = await checkUser();

  return <CreateProject user={user} />
}

export default NewPage