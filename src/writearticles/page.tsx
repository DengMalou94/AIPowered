import { Article } from "../components/Article";
import Header from "../components/Header";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import "@copilotkit/react-ui/styles.css";
import "@copilotkit/react-textarea/styles.css";
import { CopilotKitProps } from '@copilotkit/react-core';

export default function WriteArticle() {
  interface ExtendedCopilotKitProps extends CopilotKitProps {
    url: string;
  }
  return (
    <>
      <Header />
      <CopilotKit {...({ url: "/api/copilotkit/route" } as ExtendedCopilotKitProps)}>
        <CopilotSidebar
          instructions="Help the user research a blog article topic."
          defaultOpen={true}
          labels={{
            title: "Blog Article Copilot",
            initial:
              "Hi you! 👋 I can help you research any topic for a blog article.",
          }}
          clickOutsideToClose={false}>
          <Article />
        </CopilotSidebar>
      </CopilotKit>
    </>
  );
}

