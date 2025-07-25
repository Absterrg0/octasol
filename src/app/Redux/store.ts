import { configureStore } from "@reduxjs/toolkit";
import {
  gitReducer,
  installationIdReducer,
} from "./Features/git/githubInstallation";
import { repoReducer, selectedRepoReducer } from "./Features/git/repoInitialize";
import { errorReducer } from "./Features/error/error";
import { searchReducer } from "./Features/git/search";
import userReducer from "./Features/user/userSlice";
import counterReducer from "./Features/loader/loaderSlice";
import { profileReducer } from "./Features/profile/profileSlice";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";
import { combineReducers } from "redux";
import { issuesReducer } from "./Features/git/issues";

const persistConfig = {
  key: "root",
  storage,
  whitelist: ["profile"],
};

const rootReducer = combineReducers({
  user: userReducer,
  git: gitReducer,
  error: errorReducer,
  repo: repoReducer,
  installationId: installationIdReducer,
  search: searchReducer,
  repoData: repoReducer,
  selectedRepo: selectedRepoReducer,
  counter: counterReducer,
  profile: profileReducer,
  issues: issuesReducer,
});

const persistedReducer = persistReducer(persistConfig, rootReducer);
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: ["persist/PERSIST", "persist/REHYDRATE"],
      },
    }),
});
export const persistor = persistStore(store);
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
