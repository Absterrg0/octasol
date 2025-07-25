"use client";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";


export interface Issue {
  id: number
  number: number
  title: string
  state: string
  created_at: string
  user: {
    login: string
    avatar_url: string
  }
  labels: Array<{ name: string; color: string }>
  html_url: string
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