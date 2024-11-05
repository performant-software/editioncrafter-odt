import React from "react";
import EditionCrafter from '@cu-mkp/editioncrafter';
import config from '../data/config.json'

const configProps = {
  ...config,
  id: 'ec'
}

const App = () => {
  return (
    <EditionCrafter
      { ...configProps }
    />
  );
};

export default App;
