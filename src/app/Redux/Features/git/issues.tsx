"use client";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";


export interface Issue {
  id: number
  number: number
  body:string
  title: string
  state: string
  created_at: string
  user: {
    login: string
    avatar_url: string
  }
  labels: Array<{ name: string; color: string }>
  html_url: string,
  status: "NORMAL" | "BOUNTY_INIT" | "ESCROW_INIT" | "CANCELLATION_PENDING"
}
const initialIssuesState: Issue[] = [];

export const issuesSlice = createSlice({
  name: "issues",
  initialState: initialIssuesState,
  reducers: {
    setIssues: (state, action: PayloadAction<Issue[]>) => {
      return action.payload;
    },
  },
});

export const { setIssues } = issuesSlice.actions;
export const issuesReducer = issuesSlice.reducer; 