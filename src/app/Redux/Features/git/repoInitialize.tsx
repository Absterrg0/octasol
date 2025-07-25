"use client";
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface Repository {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

const initialRepoState: Repository[] = [];
const initialRepoDataState = {};
const initialSelectedRepoState: Repository | null = null;

export const repoSlice = createSlice({
  name: "repo",
  initialState: initialRepoState,
  reducers: {
    setRepositories: (state, action: PayloadAction<Repository[]>) => {
      return action.payload;
    },
  },
});

export const repoData = createSlice({
  name: "repoData",
  initialState: initialRepoDataState,
  reducers: {
    setRepoData: (state, action: PayloadAction<Repository>) => {
      return action.payload;
    },
  },
});

export const selectedRepoSlice = createSlice({
  name: "selectedRepo",
  initialState: initialSelectedRepoState,
  reducers: {
    setSelectedRepo: (state, action: PayloadAction<Repository | null>) => {
      return action.payload as any;
    },
    clearSelectedRepo: () => null,
  },
});

export const { setRepositories } = repoSlice.actions;
export const { setRepoData } = repoData.actions;
export const { setSelectedRepo, clearSelectedRepo } = selectedRepoSlice.actions;
export const repoReducer = repoSlice.reducer;
export const repoDataReducer = repoData.reducer;
export const selectedRepoReducer = selectedRepoSlice.reducer;
