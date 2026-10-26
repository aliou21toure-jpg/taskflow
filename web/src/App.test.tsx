import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
import { installFakeApi, makeTask } from "./test/fakeApi";

const existing = () => [makeTask({ id: "a", title: "Existing task", assignee: "ana" })];

async function signedIn(tasks = existing()) {
  const fake = installFakeApi({ signedInAs: "ana@example.com", tasks });
  render(<App />);
  await screen.findByText(tasks[0]?.title ?? /No tasks yet/);
  return fake;
}

describe("signing in", () => {
  it("shows the sign-in screen when there is no session", async () => {
    installFakeApi();
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("signs in and shows the user's tasks", async () => {
    installFakeApi({ tasks: existing() });
    render(<App />);
    await userEvent.type(await screen.findByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "correct horse");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Existing task")).toBeInTheDocument();
    expect(screen.getByText("ana@example.com")).toBeInTheDocument();
  });

  it("shows the server's error for a wrong password and keeps the email", async () => {
    installFakeApi();
    render(<App />);
    await userEvent.type(await screen.findByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByLabelText("Email")).toHaveValue("ana@example.com");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("creates an account and lands on an empty board", async () => {
    installFakeApi();
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    await userEvent.type(screen.getByLabelText("Email"), "new@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "a long passphrase");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByText(/No tasks yet/)).toBeInTheDocument();
  });

  it("explains a duplicate email on sign-up", async () => {
    installFakeApi();
    render(<App />);
    await userEvent.click(await screen.findByRole("button", { name: "Create an account" }));
    await userEvent.type(screen.getByLabelText("Email"), "ana@example.com");
    await userEvent.type(screen.getByLabelText("Password"), "another password");
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
  });

  it("signs out", async () => {
    await signedIn();
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("signed out");
  });

  it("returns to sign-in with a notice when the session expires", async () => {
    const fake = await signedIn();
    fake.expireSession();
    await userEvent.selectOptions(screen.getByLabelText("Status of Existing task"), "done");
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("session has ended");
  });

  it("offers a retry when the server can't be reached", async () => {
    const fake = installFakeApi({ signedInAs: "ana@example.com", tasks: existing() });
    fake.failNext("GET", /^\/auth\/me$/, 0);
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the server");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Existing task")).toBeInTheDocument();
  });
});

describe("tasks", () => {
  it("shows a loading indicator, then the tasks", async () => {
    installFakeApi({ signedInAs: "ana@example.com", tasks: existing() });
    render(<App />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(await screen.findByText("Existing task")).toBeInTheDocument();
  });

  it("creates a task with a description and clears the form", async () => {
    await signedIn();
    await userEvent.type(screen.getByLabelText("Task title"), "Write README");
    await userEvent.type(screen.getByLabelText("Description"), "Screenshots and a diagram");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(await screen.findByText("Write README")).toBeInTheDocument();
    expect(screen.getByText("Screenshots and a diagram")).toBeInTheDocument();
    expect(screen.getByLabelText("Task title")).toHaveValue("");
  });

  it("keeps what was typed when saving a new task fails", async () => {
    const fake = await signedIn();
    fake.failNext("POST", /^\/tasks$/, 500, "Internal server error");
    await userEvent.type(screen.getByLabelText("Task title"), "Don't lose me");
    await userEvent.selectOptions(screen.getByLabelText("Priority"), "high");
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save the task: Internal server error");
    expect(screen.getByLabelText("Task title")).toHaveValue("Don't lose me");
    expect(screen.getByLabelText("Priority")).toHaveValue("high");
    expect(screen.queryByText("Don't lose me", { selector: ".task__title" })).not.toBeInTheDocument();

    // Retrying the same input works.
    await userEvent.click(screen.getByRole("button", { name: "Add task" }));
    expect(await screen.findByText("Don't lose me", { selector: ".task__title" })).toBeInTheDocument();
  });

  it("edits every field of a task", async () => {
    await signedIn();
    await userEvent.click(screen.getByLabelText("Edit Existing task"));
    const title = screen.getByLabelText("Edit title");
    await userEvent.clear(title);
    await userEvent.type(title, "Renamed task");
    await userEvent.type(screen.getByLabelText("Edit description"), "More detail");
    await userEvent.selectOptions(screen.getByLabelText("Edit priority"), "low");
    await userEvent.clear(screen.getByLabelText("Edit assignee"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    const item = (await screen.findByText("Renamed task")).closest("li")!;
    expect(within(item).getByText("More detail")).toBeInTheDocument();
    expect(within(item).getByText("low")).toBeInTheDocument();
    expect(within(item).queryByText("@ana")).not.toBeInTheDocument();
  });

  it("keeps the edit form open with an error when saving fails", async () => {
    const fake = await signedIn();
    fake.failNext("PATCH", /^\/tasks\//, 400, "title is required");
    await userEvent.click(screen.getByLabelText("Edit Existing task"));
    await userEvent.type(screen.getByLabelText("Edit title"), " v2");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't save: title is required");
    expect(screen.getByLabelText("Edit title")).toHaveValue("Existing task v2");
  });

  it("cancelling an edit discards the changes", async () => {
    await signedIn();
    await userEvent.click(screen.getByLabelText("Edit Existing task"));
    await userEvent.type(screen.getByLabelText("Edit title"), " changed");
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.getByText("Existing task")).toBeInTheDocument();
  });

  it("changes status and deletes", async () => {
    await signedIn();
    await userEvent.selectOptions(screen.getByLabelText("Status of Existing task"), "done");
    await waitFor(() => expect(screen.getByLabelText("Task counts")).toHaveTextContent("1 Done"));
    await userEvent.click(screen.getByLabelText("Delete Existing task"));
    expect(await screen.findByText(/No tasks yet/)).toBeInTheDocument();
  });

  it("shows an error on the task when deleting fails, and keeps it", async () => {
    const fake = await signedIn();
    fake.failNext("DELETE", /^\/tasks\//, 500, "Internal server error");
    await userEvent.click(screen.getByLabelText("Delete Existing task"));
    expect(await screen.findByRole("alert")).toHaveTextContent("Internal server error");
    expect(screen.getByText("Existing task")).toBeInTheDocument();
  });

  it("shows a retryable error when the list fails to load", async () => {
    const fake = installFakeApi({ signedInAs: "ana@example.com", tasks: existing() });
    fake.failNext("GET", /^\/tasks$/, 500, "Internal server error");
    render(<App />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't load your tasks");
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("Existing task")).toBeInTheDocument();
  });

  it("searches after typing pauses", async () => {
    const fake = await signedIn([makeTask({ id: "a", title: "Fix login" }), makeTask({ id: "b", title: "Write docs" })]);
    const before = fake.fetchMock.mock.calls.length;
    await userEvent.type(screen.getByLabelText("Search"), "docs");
    await waitFor(() => expect(screen.queryByText("Fix login")).not.toBeInTheDocument());
    expect(screen.getByText("Write docs")).toBeInTheDocument();
    // One list + one stats request for the whole word, not one per keystroke.
    expect(fake.fetchMock.mock.calls.length - before).toBe(2);
  });
});
