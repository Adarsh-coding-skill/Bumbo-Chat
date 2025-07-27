import React, { useState } from "react";
import { styled } from '@mui/material/styles';
import RadioGroup, { useRadioGroup } from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import PropTypes from 'prop-types';

import Radio from '@mui/material/Radio';
// import { useRadioGroup } from '@mui/material/RadioGroup';
// import "../../CSS/main.css"
import "../../CSS/Findchat.css";
import Box from '@mui/material/Box';

import TextField from '@mui/material/TextField';
import Input from "@mui/material/Input";
import Button from "@mui/material/Button";

const CustomRadio = styled((props) => <Radio {...props} />)(({ theme }) => ({
  '&.Mui-checked': {
    color: "#00FFF7",
  },
  '&.Mui-checked .MuiSvgIcon-root': {
    fill: "#C165FF",
    borderColor: "#00FFF7",
  },
}));

const StyledFormControlLabel = styled(({ checked, ...props }) => (
  <FormControlLabel {...props} />
))(({ checked }) => ({
  ".MuiFormControlLabel-label": {
    color: checked ? "#00FFF7" : "#fff", // Cyan label if selected
    fontWeight: checked ? "600" : "400",
    transition: "color 0.3s ease",
    textAlign: "center",
    width: "100%",
  },
}));

function MyFormControlLabel(props) {
  const radioGroup = useRadioGroup();

  let checked = false;

  if (radioGroup) {
    checked = radioGroup?.value === props.value;

  }

  return <StyledFormControlLabel
    checked={checked}{...props} />;
}

MyFormControlLabel.protoTypes = {
  value: PropTypes.any,
  label: PropTypes.string,
  control: PropTypes.element,

}

export function FindChat() {

  const [matchType, setMatchType] = useState("random");

  const handleChange = (event) => {
    setMatchType(event.target.value);
  };

  return (
    <>
      <div className="findChat-box">
        <div className="findChat-header">
          <h2>Bumbo Chat</h2>
          <br />
          <h4>Match type:</h4>
        </div>
        <div>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
           <RadioGroup name="use-radio-group" value={matchType} onChange={handleChange} >
  <MyFormControlLabel className="label" value="interest" label="Interest Based" control={<CustomRadio />} />
  <MyFormControlLabel className="label" value="random" label="Random" control={<CustomRadio />} />
</RadioGroup>

<div className="tags-input-container">
{matchType === "interest" && (
  <TextField
 variant="standard"
    placeholder="Type an interest and press Enter"
    InputProps={{
      style: {
        color: "#fff",
        borderColor: "#C165FF",
        background: "transparent",
      },
    }}
    sx={{
      width: "100%",
      maxWidth: "400px",
      overflow: "hidden",
      textUnderlineOffset: "hidden",
      input: { color: "#fff", textAlign: "center" },
      
    }}
    required
  />
)}
</div>
<Button className="start-Button"
sx={{
  border: "1px solid #C165FF",
  color: "#C165FF"}}
 variant="outlined">start chatting</Button>
          </Box>
        </div>
</div>

      

    </>
  )

}

export default FindChat