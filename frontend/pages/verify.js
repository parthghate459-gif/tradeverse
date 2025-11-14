
import { useState } from 'react';
import axios from 'axios';
export default function Verify(){
  const [userId,setUserId]=useState('');
  const [challengeId,setChallengeId]=useState('');
  const [ref,setRef]=useState('');
  const [msg,setMsg]=useState('');
  const submit = async ()=>{
    try{
      const r = await axios.post('/api/payment/confirm', { user_id:userId, challenge_id:challengeId, cashfree_ref:ref });
      setMsg(JSON.stringify(r.data));
    }catch(e){ setMsg('error '+e.message); }
  }
  return (
    <div style={{padding:20}}>
      <h1>Verify Payment</h1>
      <input placeholder="Your user id" value={userId} onChange={e=>setUserId(e.target.value)} />
      <br/>
      <input placeholder="Challenge id" value={challengeId} onChange={e=>setChallengeId(e.target.value)} />
      <br/>
      <input placeholder="Cashfree payment ref" value={ref} onChange={e=>setRef(e.target.value)} />
      <br/>
      <button onClick={submit}>Verify & Create Account</button>
      <pre>{msg}</pre>
    </div>
  )
}
